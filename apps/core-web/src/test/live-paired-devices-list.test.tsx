/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W81: the device list, the revoke dialog and the page states of the Paired Devices page
// (backend task 04_client_integration_spec §10.1 states table, §10.3 "The device list" and "The
// revoke dialog"), on the contract-checked fake transport through W50's harness.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | §10.3: order (PAIRED first, then newest `pairedAt`), the columns, the filter, the header chip, "Last seen" every 30 s | "the list" |
// | PG-6 / decision D156 (3): operation 19's raw answer under `CORE_QUERY_KEYS.pairedDevices`; `admin.changed` DEVICES refetches; a new row is highlighted | "the list" |
// | RESIDUAL-W70-1 (W83 ledger #45) (decision D156 (2)): a change of the replicated tablet link reads the list again | "the list" |
// | AC-C-98: revoke needs a reason of 5+ characters (validated on submit), sends operation 20, the row morphs to REVOKED; 422 keeps the dialog; 409 / 404 close it with the info toast | "AC-C-98" |
// | AC-C-48 / PG-11: a refused revoke (403 by `notPermitted`) closes the dialog with the denied toast; an outage and a 429 keep it open (LB-6, LB-10); LB-1 on the confirm | "AC-C-98" |
// | AC-C-99: loading, empty, error (with a rate-limited Retry), forbidden (one denied toast for both reads) and "Live mode only" | "AC-C-99" |
// | Offline: the last data stays and the commands are disabled | "AC-C-99" |
import { createElement } from 'react'
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PairedDevice } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { rateLimited } from '@dems/shared/live/testing'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import {
  clearToasts,
  disposeBed,
  installPageStubs,
  openPairedDevices,
  registryDevice,
  toastsWith,
} from '@/features/paired-devices/__tests__/pd-bed'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { createAppRouter } from '@/router'
import { CORE_QUERY_KEYS, webErrorSink } from '@/runtime'
import type { LiveTestBed } from '@/runtime/testing/live-harness'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

vi.mock('qrcode.react', () => ({ QRCodeSVG: () => createElement('svg', { 'data-testid': 'pd-qr', role: 'img' }) }))

const D = en.pairedDevices.devices
const R = en.pairedDevices.revoke
const DENIED = en.common.rbac.deniedTitle
const REQUIRES_SUPERVISOR = en.common.rbac.requiresRole.replace('{{role}}', en.common.roles.SUPERVISOR)
const OFFLINE = en.common.coreErrors.offline
const LIMITED = (seconds: number) => en.common.coreErrors.limited.replace('{{seconds}}', String(seconds))
const REVOKED_TOAST = (id: string) => en.pairedDevices.toasts.revoked.replace('{{deviceId}}', id)
const MINUTE = 60_000

/** Three devices: two PAIRED (one online), one REVOKED that was paired last. */
function threeDevices(bed: LiveTestBed): PairedDevice[] {
  const now = bed.fake.clock.now()
  return [
    registryDevice(bed, {
      id: 'DEV-0001',
      name: 'Old tablet',
      state: 'REVOKED',
      pairedAt: now - 1 * MINUTE,
      online: false,
      signedInOperatorId: null,
      revokedAt: now - 30_000,
      revokedBy: 'OPR-002',
      revokeReason: 'Tablet reported lost',
      lastSeenAt: now - 2 * MINUTE,
    }),
    registryDevice(bed, { id: 'DEV-0002', name: 'Interview tablet 02', pairedAt: now - 60 * MINUTE, online: false, signedInOperatorId: null, lastSeenAt: now - 5 * MINUTE }),
    registryDevice(bed, { id: 'DEV-0003', name: 'Interview tablet 03', pairedAt: now - 10 * MINUTE, online: true, signedInOperatorId: 'OPR-001', lastSeenAt: now }),
  ]
}

const rowIds = () => within(screen.getByTestId('pd-devices-table')).queryAllByTestId(/^pd-device-/).map((row) => row.getAttribute('data-testid'))

async function openRevoke(deviceId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`pd-revoke-${deviceId}`))
  })
  return screen.findByTestId('pd-revoke-dialog')
}

async function typeReason(text: string) {
  const field = screen.getByTestId('pd-revoke-reason')
  await act(async () => {
    fireEvent.change(field, { target: { value: text } })
  })
}

async function submitRevoke() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('pd-revoke-confirm'))
  })
}

let restoreStubs: () => void = () => undefined
beforeAll(() => {
  restoreStubs = installPageStubs()
})
afterAll(() => restoreStubs())

const sims: Sim[] = []
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
  for (const sim of sims.splice(0)) sim.stop()
  disposeBed()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the list (§10.3; PG-6; RESIDUAL-W70-1)', () => {
  it('PAIRED first, then by `pairedAt` newest first; every column; the revoke action on PAIRED rows only; the header chip', async () => {
    const { mounted, core } = await openPairedDevices({ script: (bed, c) => (c.devices = threeDevices(bed)), waitFor: 'pd-devices-table' })
    expect(rowIds()).toEqual(['pd-device-DEV-0003', 'pd-device-DEV-0002', 'pd-device-DEV-0001'])

    const online = screen.getByTestId('pd-device-DEV-0003')
    expect(within(online).getByText('DEV-0003')).toBeInTheDocument()
    expect(within(online).getByText('Interview tablet 03')).toBeInTheDocument()
    expect(within(online).getByText('android · 0.2.0')).toBeInTheDocument()
    expect(within(online).getByTestId('pd-state-DEV-0003')).toHaveTextContent(D.state.PAIRED)
    expect(within(online).getByTestId('pd-online-DEV-0003')).toHaveAttribute('data-online', 'true')
    // Fix wave J round three (N-15): the state is also a WORD beside the dot, not a colour alone.
    expect(within(online).getByTestId('pd-online-word-DEV-0003')).toHaveTextContent(/^Online$/)
    expect(within(online).getByTestId('pd-operator-DEV-0003')).toHaveTextContent('AKP Budi Santoso')
    expect(within(online).getByText('code issued by AKP Andi Pratama')).toBeInTheDocument()
    expect(within(online).getByTestId('pd-last-seen-DEV-0003')).toHaveTextContent(D.lastSeen.justNow)
    expect(within(online).getByTestId('pd-revoke-DEV-0003')).toHaveTextContent(D.revoke)

    const offline = screen.getByTestId('pd-device-DEV-0002')
    expect(within(offline).getByTestId('pd-online-DEV-0002')).toHaveAttribute('data-online', 'false')
    expect(within(offline).getByTestId('pd-online-word-DEV-0002')).toHaveTextContent(/^Offline$/)
    expect(within(offline).getByTestId('pd-operator-DEV-0002')).toHaveTextContent('—')
    expect(within(offline).getByTestId('pd-last-seen-DEV-0002')).toHaveTextContent('5 min ago')

    const ended = screen.getByTestId('pd-device-DEV-0001')
    expect(within(ended).getByTestId('pd-state-DEV-0001')).toHaveTextContent(D.state.REVOKED)
    expect(within(ended).getByText('Revoked by AKP Andi Pratama')).toBeInTheDocument()
    expect(within(ended).getByText('Tablet reported lost')).toBeInTheDocument()
    expect(within(ended).queryByTestId('pd-revoke-DEV-0001')).not.toBeInTheDocument()

    expect(within(screen.getByTestId('pd-summary')).getByText('2 paired · 1 online')).toBeInTheDocument()
    expect(screen.getByTestId('pd-summary')).toHaveAttribute('data-paired', '2')
    // Decision D156 (3): the operation's own answer, the entry the Devices drawer shares.
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.pairedDevices)).toEqual({ devices: core.devices })
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the filter: Paired shows the two PAIRED rows, Ended the REVOKED one, All every row', async () => {
    await openPairedDevices({ script: (bed, core) => (core.devices = threeDevices(bed)), waitFor: 'pd-devices-table' })
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-filter-PAIRED'))
    })
    await waitFor(() => expect(rowIds()).toEqual(['pd-device-DEV-0003', 'pd-device-DEV-0002']))
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-filter-ENDED'))
    })
    await waitFor(() => expect(rowIds()).toEqual(['pd-device-DEV-0001']))
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-filter-ALL'))
    })
    await waitFor(() => expect(rowIds()).toHaveLength(3))
  })

  it('"Last seen" moves on the Live clock in steps of 30 s, without a request', async () => {
    const { bed, requests } = await openPairedDevices({ script: (b, core) => (core.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    const reads = requests('listPairedDevices').length
    await bed.elapse(MINUTE, 1_000)
    await waitFor(() => expect(screen.getByTestId('pd-last-seen-DEV-0002')).toHaveTextContent('6 min ago'))
    expect(requests('listPairedDevices')).toHaveLength(reads)
  })

  it('PG-6: `admin.changed` DEVICES reads the registry again; the new row enters highlighted, the chip counts it', async () => {
    const { bed, core } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    expect(screen.getByTestId('pd-device-DEV-0003')).not.toHaveAttribute('data-highlight')
    core.devices = [...core.devices, registryDevice(bed, { id: 'DEV-0004', name: 'Interview phone 04', pairedAt: bed.fake.clock.now(), online: true })]
    await act(async () => {
      bed.core.adminChanged('DEVICES')
    })
    await bed.flush()
    const row = await screen.findByTestId('pd-device-DEV-0004')
    expect(row).toHaveAttribute('data-highlight', 'true')
    expect(rowIds()[0]).toBe('pd-device-DEV-0004')
    expect(screen.getByTestId('pd-device-DEV-0003')).not.toHaveAttribute('data-highlight')
    await waitFor(() => expect(screen.getByTestId('pd-summary')).toHaveAttribute('data-paired', '3'))
  })

  it('RESIDUAL-W70-1: a change of the replicated tablet link reads the list again, so `online` does not go stale', async () => {
    const { bed, core, requests } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    const reads = requests('listPairedDevices').length
    core.devices = core.devices.map((device) => (device.id === 'DEV-0003' ? { ...device, online: false } : device))
    const tabletLink = { ...bed.core.served.tabletLink, state: 'OFFLINE', changedAt: bed.fake.clock.now() + 1_000 }
    await act(async () => {
      bed.fake.connection().delta([{ op: 'replace', slice: 'tabletLink', value: tabletLink }] as never)
    })
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('pd-online-DEV-0003')).toHaveAttribute('data-online', 'false'))
    expect(requests('listPairedDevices')).toHaveLength(reads + 1)
  })
})

describe('AC-C-98: revoke with a reason', () => {
  it('a reason under 5 characters is refused on submit without a request; a valid one sends operation 20, the row morphs to REVOKED with a toast', async () => {
    const { requests, core } = await openPairedDevices({ script: (bed, c) => (c.devices = threeDevices(bed)), waitFor: 'pd-devices-table' })
    const dialog = await openRevoke('DEV-0002')
    expect(dialog).toHaveTextContent(R.body.replace('{{deviceId}}', 'DEV-0002'))
    expect(within(dialog).getByTestId('pd-revoke-cancel')).toHaveTextContent(R.keep)
    await submitRevoke()
    await waitFor(() => expect(dialog).toHaveTextContent(R.reasonTooShort.replace('{{min}}', '5')))
    await typeReason('lost')
    await submitRevoke()
    expect(requests('revokeDevice')).toHaveLength(0)
    expect(screen.getByTestId('pd-revoke-dialog')).toBeInTheDocument()

    await typeReason('Tablet left in the car park')
    await submitRevoke()
    await waitFor(() => expect(screen.queryByTestId('pd-revoke-dialog')).not.toBeInTheDocument())
    expect(requests('revokeDevice')).toHaveLength(1)
    expect(requests('revokeDevice')[0]).toMatchObject({ method: 'POST', path: '/api/v1/pairing/devices/DEV-0002/revoke', params: { id: 'DEV-0002' }, body: { reason: 'Tablet left in the car park' } })
    await waitFor(() => expect(toastsWith(REVOKED_TOAST('DEV-0002'))).toHaveLength(1))
    await waitFor(() => expect(screen.getByTestId('pd-state-DEV-0002')).toHaveTextContent(D.state.REVOKED))
    expect(screen.queryByTestId('pd-revoke-DEV-0002')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('pd-device-DEV-0002')).getByText('Tablet left in the car park')).toBeInTheDocument()
    expect(core.devices.find((device) => device.id === 'DEV-0002')?.state).toBe('REVOKED')
    // The reason is not in the page's log.
    expect(JSON.stringify(webErrorSink.records())).not.toContain('car park')
  })

  it('422 INVALID_REASON (the Core counts the trimmed text itself, F59): the field\'s error, the dialog stays with the text', async () => {
    const { bed } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    bed.fake.answerOnce('revokeDevice', bed.fake.example('revokeDevice', 422, 'invalidReason'))
    const dialog = await openRevoke('DEV-0002')
    await typeReason('Lost!')
    await submitRevoke()
    await waitFor(() => expect(dialog).toHaveTextContent(R.reasonTooShort.replace('{{min}}', '5')))
    expect(screen.getByTestId('pd-revoke-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('pd-revoke-reason')).toHaveValue('Lost!')
  })

  it('422 INVALID_INPUT (a reason of the form of a credential): the field says to word it otherwise', async () => {
    const { bed } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    bed.fake.answerOnce('revokeDevice', bed.fake.example('revokeDevice', 422, 'invalidInput'))
    const dialog = await openRevoke('DEV-0002')
    await typeReason('Reason that the Core refuses')
    await submitRevoke()
    await waitFor(() => expect(dialog).toHaveTextContent(R.reasonRefused))
  })

  it.each([
    [409, 'invalidState'],
    [404, 'notFound'],
  ] as const)('%i: the dialog closes with the info toast and the list is read again', async (status, example) => {
    const { bed, requests } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    const reads = requests('listPairedDevices').length
    bed.fake.answerOnce('revokeDevice', bed.fake.example('revokeDevice', status, example))
    await openRevoke('DEV-0002')
    await typeReason('Tablet reported lost')
    await submitRevoke()
    await waitFor(() => expect(screen.queryByTestId('pd-revoke-dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(toastsWith(en.pairedDevices.toasts.alreadyEnded)).toHaveLength(1))
    await waitFor(() => expect(requests('listPairedDevices').length).toBeGreaterThan(reads))
  })

  it('a 403 by its `notPermitted` example closes the dialog with the denied toast naming the Supervisor (PG-11)', async () => {
    const { bed } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    bed.fake.answerOnce('revokeDevice', bed.fake.example('revokeDevice', 403, 'notPermitted'))
    await openRevoke('DEV-0002')
    await typeReason('Tablet reported lost')
    await submitRevoke()
    await waitFor(() => expect(toastsWith(DENIED)).toHaveLength(1))
    expect(toastsWith(DENIED)[0]).toContain(REQUIRES_SUPERVISOR)
    await waitFor(() => expect(screen.queryByTestId('pd-revoke-dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('pd-state-DEV-0002')).toHaveTextContent(D.state.PAIRED)
  })

  it('an outage keeps the dialog open with the reason (LB-6); a 429 too, worded as a limit (LB-10)', async () => {
    const { bed } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    bed.fake.failOnce('revokeDevice')
    await openRevoke('DEV-0002')
    await typeReason('Tablet reported lost')
    await submitRevoke()
    await waitFor(() => expect(toastsWith(OFFLINE)).toHaveLength(1))
    expect(screen.getByTestId('pd-revoke-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('pd-revoke-reason')).toHaveValue('Tablet reported lost')

    bed.fake.answerOnce('revokeDevice', rateLimited(17))
    await submitRevoke()
    await waitFor(() => expect(toastsWith(LIMITED(17))).toHaveLength(1))
    expect(screen.getByTestId('pd-revoke-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('pd-revoke-reason')).toHaveValue('Tablet reported lost')
    expect(screen.getByTestId('pd-revoke-confirm')).not.toHaveAttribute('aria-busy')
  })

  it('LB-1: the confirm is busy at once with the busy mark; a second submit sends nothing', async () => {
    const { bed, requests } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    const held = bed.fake.hold('revokeDevice')
    await openRevoke('DEV-0002')
    await typeReason('Tablet reported lost')
    await submitRevoke()
    expect(screen.getByTestId('pd-revoke-confirm')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('pd-revoke-cancel')).toBeDisabled()
    await submitRevoke()
    await bed.flush()
    expect(requests('revokeDevice')).toHaveLength(1)
    await act(async () => {
      held.release(bed.fake.example('revokeDevice', 409, 'invalidState'))
    })
    await waitFor(() => expect(screen.queryByTestId('pd-revoke-dialog')).not.toBeInTheDocument())
  })
})

describe('AC-C-99: the states of §10.1', () => {
  it('loading: three skeleton rows in the table\'s place until the registry answers', async () => {
    const { bed } = await openPairedDevices({
      script: (b) => {
        b.fake.hold('listPairedDevices')
      },
      waitFor: 'pd-loading',
    })
    expect(screen.getByTestId('pd-loading').querySelectorAll('.pd-skeleton-row')).toHaveLength(3)
    expect(screen.queryByTestId('pd-devices-table')).not.toBeInTheDocument()
    void bed
  })

  it('empty: "No device has been paired yet." and the pointer to the issue panel; no filter', async () => {
    await openPairedDevices({ waitFor: 'pd-empty' })
    expect(screen.getByTestId('pd-empty')).toHaveTextContent(D.empty)
    expect(screen.getByTestId('pd-empty')).toHaveTextContent(D.emptyHint)
    expect(screen.queryByTestId('pd-filter')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('pd-summary')).getByText('0 paired · 0 online')).toBeInTheDocument()
  })

  it('error: an outage of the read shows the presenter\'s toast and the panel\'s Alert; Retry reads again', async () => {
    const { bed, requests } = await openPairedDevices({
      script: (b, core) => {
        core.devices = threeDevices(b)
        b.fake.failOnce('listPairedDevices')
      },
      waitFor: 'pd-error',
    })
    expect(screen.getByTestId('pd-error')).toHaveTextContent(D.error)
    await waitFor(() => expect(toastsWith(OFFLINE)).toHaveLength(1))
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-retry'))
    })
    await screen.findByTestId('pd-devices-table')
    expect(requests('listPairedDevices')).toHaveLength(2)
    void bed
  })

  it('a 429 of the read is a limit: the limit toast, no offline words', async () => {
    await openPairedDevices({ script: (b) => b.fake.answerOnce('listPairedDevices', rateLimited(9)), waitFor: 'pd-error' })
    await waitFor(() => expect(toastsWith(LIMITED(9))).toHaveLength(1))
    expect(toastsWith(OFFLINE)).toEqual([])
  })

  it('forbidden: both reads answer 403 by `notPermitted` → the page-level state with a link to the Dashboard, and ONE denied toast', async () => {
    const danger = vi.spyOn(toast, 'danger')
    const { mounted, requests } = await openPairedDevices({
      script: (b) => {
        b.fake.answer('getPairingCodeStatus', b.fake.example('getPairingCodeStatus', 403, 'notPermitted'))
        b.fake.answer('listPairedDevices', b.fake.example('listPairedDevices', 403, 'notPermitted'))
      },
      waitFor: 'pd-forbidden',
    })
    expect(screen.getByTestId('pd-forbidden')).toHaveTextContent(en.pairedDevices.states.forbidden)
    expect(screen.queryByTestId('panel-issue')).not.toBeInTheDocument()
    expect(screen.queryByTestId('panel-devices')).not.toBeInTheDocument()
    await waitFor(() => expect(toastsWith(DENIED)).toHaveLength(1))
    // Both reads were refused, and the role was named once for the visit.
    expect(requests('getPairingCodeStatus')).toHaveLength(1)
    expect(requests('listPairedDevices')).toHaveLength(1)
    expect(danger.mock.calls.filter(([title]) => title === DENIED)).toHaveLength(1)
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-forbidden-dashboard'))
    })
    await waitFor(() => expect(mounted.router.state.location.pathname).toBe('/dashboard'))
  })

  it('offline: the last data stays; "Revoke…" and "Issue pairing code" are disabled', async () => {
    const { bed } = await openPairedDevices({ script: (b, c) => (c.devices = threeDevices(b)), waitFor: 'pd-devices-table' })
    await act(async () => {
      bed.core.unreachable()
    })
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('pd-revoke-DEV-0002')).toBeDisabled())
    expect(screen.getByTestId('pd-issue')).toBeDisabled()
    expect(rowIds()).toHaveLength(3)
  })

  it('"Live mode only" in Simulated mode: the shared state inside the page\'s own grid (F76-12), and no request', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
    const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const router = createAppRouter(
      {
        sim,
        queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
        socketFactory: () =>
          ({ readyState: 0, onopen: null, onmessage: null, onclose: null, onerror: null, close() {} }) as unknown as SocketLike,
      },
      { history: createMemoryHistory({ initialEntries: ['/admin/devices'] }) },
    )
    render(createElement(RouterProvider, { router }))
    const page = await screen.findByTestId('page-paired-devices')
    const state = within(page).getByTestId('pd-live-only')
    expect(state).toHaveTextContent(en.pairedDevices.states.liveOnly)
    expect(state.closest('.pd-state-cell')).not.toBeNull()
    expect(state.closest('.pd-grid')).not.toBeNull()
    expect(within(page).queryByTestId('pd-issue-panel')).not.toBeInTheDocument()
    expect(fetchSpy.mock.calls.map((call) => String((call as unknown[])[0]))).not.toEqual(expect.arrayContaining([expect.stringContaining('/pairing/')]))
  })
})
