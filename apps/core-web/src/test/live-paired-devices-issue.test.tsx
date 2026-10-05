/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W81: the issue-code panel of the Paired Devices page in Live mode (backend task
// 04_client_integration_spec §10.3), on the contract-checked fake transport through W50's harness.
// The QR component is replaced by a stub that records its props (§10.3 "The QR in tests").
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-92: issue sends operation 15; six digits, the QR, the countdown; the QR receives exactly the answer's `qrPayload`, the prefix plus the digits shown | "AC-C-92" |
// | AC-C-93: the countdown reaches zero at `expiresAt` and the expired state shows; the hairline's tones | "AC-C-93" |
// | AC-C-94: while a code is active no second issue is offered; "Cancel code" sends operation 17 and returns to Idle | "AC-C-94" |
// | AC-C-95: a fresh mount with an active code on the Core shows "A pairing code is active" and no digits | "AC-C-95" |
// | AC-C-97: `admin.changed` DEVICES after a redeem shows Paired and a new highlighted row; Idle after 4 s | "AC-C-97" |
// | §10.3: closed after wrong attempts, cancelled elsewhere, replaced elsewhere, the attempts left | "the other end states" |
// | AC-C-99 / AC-C-48: a refused issue (403 by its `notPermitted` example) shows the denied toast; an outage the Error state with Retry; a 429 is a limit (LB-10) | "refusals, outages and limits" |
// | LB-1 (row W0 §15): busy at once with the busy mark, one request for two presses, the spinner after the reveal; StrictMode sends one request per read and per press | "pending and StrictMode" |
import { createElement } from 'react'
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { rateLimited } from '@dems/shared/live/testing'
import { codeMemoryOf } from '@/features/paired-devices/code-memory'
import {
  appendAuditRow,
  clearToasts,
  CODE_LIFETIME_MS,
  disposeBed,
  installPageStubs,
  MARKER_CODE,
  MARKER_QR,
  openPairedDevices,
  registryDevice,
  toastsWith,
} from '@/features/paired-devices/__tests__/pd-bed'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { CORE_QUERY_KEYS, webErrorSink } from '@/runtime'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

/** The QR stub: records every set of props it was rendered with (§10.3 "The QR in tests"). */
const qr = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>>, real: false }))
vi.mock('qrcode.react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('qrcode.react')>()
  return {
    ...actual,
    QRCodeSVG: (props: Record<string, unknown>) => {
      qr.calls.push(props)
      if (qr.real) return createElement(actual.QRCodeSVG, props as never)
      return createElement('svg', { 'data-testid': props['data-testid'], 'data-qr-stub': 'true', role: 'img', 'aria-label': props['aria-label'] })
    },
  }
})

const I = en.pairedDevices.issue
const DENIED = en.common.rbac.deniedTitle
const REQUIRES_SUPERVISOR = en.common.rbac.requiresRole.replace('{{role}}', en.common.roles.SUPERVISOR)
const OFFLINE = en.common.coreErrors.offline
const LIMITED = (seconds: number) => en.common.coreErrors.limited.replace('{{seconds}}', String(seconds))
const EXPIRES_IN = (time: string) => I.expiresIn.replace('{{time}}', time)

const panel = () => screen.getByTestId('pd-issue-panel')
const shownDigits = () => (screen.getByTestId('pd-code').textContent ?? '').replace(/\s+/g, '')

async function pressIssue(testId = 'pd-issue') {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId))
  })
}

/** Issues the marker code and waits until its digits are revealed. */
async function issueMarker() {
  await pressIssue()
  await screen.findByTestId('pd-code')
  await waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))
}

let restoreStubs: () => void = () => undefined
beforeAll(() => {
  restoreStubs = installPageStubs()
})
afterAll(() => restoreStubs())

beforeEach(() => {
  qr.calls.length = 0
  qr.real = false
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

describe('AC-C-92: issue shows six digits, the QR and the countdown', () => {
  it('sends operation 15 once; the QR stub receives exactly the answer\'s `qrPayload`, which is the prefix plus the digits shown', async () => {
    const { requests, mounted } = await openPairedDevices()
    expect(panel()).toHaveAttribute('data-state', 'IDLE')
    expect(within(panel()).getByText(I.steps.one)).toBeInTheDocument()
    expect(requests('issuePairingCode')).toHaveLength(0)

    await issueMarker()
    expect(requests('issuePairingCode')).toHaveLength(1)
    expect(requests('issuePairingCode')[0]).toMatchObject({ method: 'POST', path: '/api/v1/pairing/code' })
    expect(panel()).toHaveAttribute('data-state', 'ACTIVE_KNOWN')
    // Two groups of three digits.
    expect(Array.from(screen.getByTestId('pd-code').children).map((group) => group.textContent)).toEqual([MARKER_CODE.slice(0, 3), MARKER_CODE.slice(3)])

    const last = qr.calls.at(-1)!
    expect(last.value).toBe(MARKER_QR)
    expect(last.value).toBe(`DEMS-PAIR:1:${shownDigits()}`)
    expect(last).toMatchObject({ size: 200, level: 'M', boostLevel: false, marginSize: 4, role: 'img', 'aria-label': I.qrLabel })
    expect(qr.calls.every((call) => call.value === MARKER_QR)).toBe(true)

    expect(screen.getByTestId('pd-countdown')).toHaveAttribute('data-seconds', '300')
    expect(within(screen.getByTestId('pd-countdown')).getByText(EXPIRES_IN('5:00'))).toBeInTheDocument()
    expect(screen.getByTestId('pd-expiry-bar')).toHaveAttribute('data-tone', 'gold')
    expect(screen.getByTestId('pd-attempts')).toHaveTextContent('5 attempts left')
    expect(within(panel()).getByText(I.caption)).toBeInTheDocument()
    // The code is held by the page load's memory, and nothing else of the page knows it.
    expect(codeMemoryOf(mounted.queryClient).held?.code).toBe(MARKER_CODE)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the real `QRCodeSVG` renders the image with its label (no stub)', async () => {
    qr.real = true
    await openPairedDevices()
    await issueMarker()
    const image = screen.getByRole('img', { name: I.qrLabel })
    expect(image.tagName.toLowerCase()).toBe('svg')
    expect(image).toHaveAttribute('data-testid', 'pd-qr')
    expect(image.querySelectorAll('path').length).toBeGreaterThan(0)
    expect(image).toHaveAttribute('width', '200')
  })
})

describe('AC-C-93: the countdown follows the Live clock and reaches zero at `expiresAt`', () => {
  it('tones: gold above 60 s, amber from 60 s, red from 15 s; at `expiresAt` the expired state shows with the digits dimmed', async () => {
    const { bed } = await openPairedDevices()
    await issueMarker()
    await bed.elapse(CODE_LIFETIME_MS - 61_000, 1_000)
    expect(screen.getByTestId('pd-countdown')).toHaveAttribute('data-seconds', '61')
    expect(screen.getByTestId('pd-expiry-bar')).toHaveAttribute('data-tone', 'gold')
    await bed.elapse(1_000, 500)
    expect(screen.getByTestId('pd-countdown')).toHaveAttribute('data-seconds', '60')
    expect(screen.getByTestId('pd-expiry-bar')).toHaveAttribute('data-tone', 'amber')
    await bed.elapse(45_000, 1_000)
    expect(screen.getByTestId('pd-countdown')).toHaveAttribute('data-seconds', '15')
    expect(screen.getByTestId('pd-expiry-bar')).toHaveAttribute('data-tone', 'red')
    await bed.elapse(14_000, 1_000)
    expect(screen.getByTestId('pd-countdown')).toHaveAttribute('data-seconds', '1')
    expect(panel()).toHaveAttribute('data-state', 'ACTIVE_KNOWN')

    await bed.elapse(1_000, 500)
    expect(panel()).toHaveAttribute('data-state', 'EXPIRED')
    expect(screen.getByTestId('pd-code-expired')).toHaveTextContent(I.expired)
    expect(screen.queryByTestId('pd-countdown')).not.toBeInTheDocument()
    expect(screen.getByTestId('pd-code')).toHaveClass('pd-dimmed')
    expect(screen.getByTestId('pd-issue')).toHaveTextContent(I.button)
  })

  it('the PAIRING_CODE_CLOSED row with EXPIRED in the replica shows the expired state before the local count', async () => {
    const { bed, core } = await openPairedDevices()
    await issueMarker()
    await appendAuditRow(bed, { type: 'PAIRING_CODE_CLOSED', details: { codeId: core.active!.codeId, reason: 'EXPIRED' } })
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'EXPIRED'))
  })
})

describe('AC-C-94: one code at a time; "Cancel code" sends operation 17 and returns to Idle', () => {
  it('no second issue is offered beside an active code; cancel → 204 → Idle with a toast, and the memory is empty', async () => {
    const { requests, mounted } = await openPairedDevices()
    await issueMarker()
    expect(screen.queryByTestId('pd-issue')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pd-issue-new')).not.toBeInTheDocument()
    expect(within(panel()).getAllByRole('button').map((button) => button.textContent)).toEqual([I.cancel])

    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-cancel-code'))
    })
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'IDLE'))
    expect(requests('cancelPairingCode')).toHaveLength(1)
    expect(requests('cancelPairingCode')[0]).toMatchObject({ method: 'POST', path: '/api/v1/pairing/code/cancel' })
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(screen.getByTestId('pd-issue')).toBeInTheDocument()
    await waitFor(() => expect(toastsWith(en.pairedDevices.toasts.cancelled)).toHaveLength(1))
    expect(codeMemoryOf(mounted.queryClient).held).toBeNull()
    // The page's own CANCELLED row does not read as "cancelled elsewhere".
    expect(screen.queryByTestId('pd-code-cancelled')).not.toBeInTheDocument()
  })
})

describe('AC-C-95: a fresh mount with an active code on the Core', () => {
  it('shows "A pairing code is active" with the issuer and the time left, no digits; "Issue new code" says it replaces the code', async () => {
    const issuedAt = Date.parse('2026-10-01T10:00:00+07:00')
    await openPairedDevices({
      core: { active: { codeId: 'PCD-000050', code: MARKER_CODE, issuedBy: 'OPR-002', issuedAt, expiresAt: issuedAt + CODE_LIFETIME_MS, attemptsRemaining: 5 } },
      script: (bed, core) => {
        core.active = { ...core.active!, issuedAt: bed.fake.clock.now() - 60_000, expiresAt: bed.fake.clock.now() + 240_000 }
      },
    })
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'ACTIVE_UNKNOWN'))
    const notice = screen.getByTestId('pd-code-active-elsewhere')
    expect(notice).toHaveTextContent(I.activeElsewhereTitle)
    expect(notice).toHaveTextContent('issued by AKP Andi Pratama, expires in 4:00')
    expect(notice).toHaveTextContent('The code itself is shown only once.')
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toContain(MARKER_CODE)
    expect(screen.getByTestId('pd-issue-new')).toHaveTextContent(I.issueNew)
    expect(within(panel()).getByText(I.issueNewHint)).toBeInTheDocument()
    expect(screen.getByTestId('pd-cancel-code')).toBeInTheDocument()
  })

  it('"Issue new code" replaces it: the new code is known to this page load', async () => {
    const { bed, requests } = await openPairedDevices({
      script: (b, core) => {
        core.active = { codeId: 'PCD-000050', code: '000000', issuedBy: 'OPR-002', issuedAt: b.fake.clock.now(), expiresAt: b.fake.clock.now() + CODE_LIFETIME_MS, attemptsRemaining: 5 }
      },
    })
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'ACTIVE_UNKNOWN'))
    await pressIssue('pd-issue-new')
    await waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))
    expect(requests('issuePairingCode')).toHaveLength(1)
    expect(panel()).toHaveAttribute('data-state', 'ACTIVE_KNOWN')
    void bed
  })
})

describe('AC-C-97: a redeem, told by `admin.changed` DEVICES', () => {
  it('shows Paired with the device, the digits leave, the new row is highlighted; after 4 s the panel is Idle', async () => {
    const { bed, core, mounted } = await openPairedDevices({ waitFor: 'pd-empty' })
    await issueMarker()
    const codeId = core.active!.codeId
    // The tablet redeems the code: the Core closes it and registers the device.
    core.active = null
    core.devices = [registryDevice(bed, { id: 'DEV-0002', name: 'Interview tablet 02', pairedWithCodeId: codeId, pairedAt: bed.fake.clock.now(), codeIssuedBy: 'OPR-002' })]
    await act(async () => {
      bed.core.adminChanged('DEVICES')
    })
    await bed.flush()
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'REDEEMED'))
    const redeemed = screen.getByTestId('pd-code-redeemed')
    expect(within(redeemed).getByText(I.pairedChip)).toBeInTheDocument()
    expect(redeemed).toHaveTextContent('DEV-0002 · Interview tablet 02 is paired.')
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(screen.getByTestId('pd-issue')).toHaveTextContent(I.issueAnother)
    expect(codeMemoryOf(mounted.queryClient).held).toBeNull()
    const row = await screen.findByTestId('pd-device-DEV-0002')
    expect(row).toHaveAttribute('data-highlight', 'true')

    await bed.elapse(4_000, 500)
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'IDLE'))
    expect(codeMemoryOf(mounted.queryClient).outcome).toBeNull()
  })
})

describe('the other end states of §10.3', () => {
  it('closed after five wrong attempts (`EXHAUSTED` in the replica): the danger Alert, the digits leave', async () => {
    const { bed, core, mounted } = await openPairedDevices()
    await issueMarker()
    await appendAuditRow(bed, { type: 'PAIRING_CODE_CLOSED', details: { codeId: core.active!.codeId, reason: 'EXHAUSTED' } })
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'EXHAUSTED'))
    expect(screen.getByTestId('pd-code-closed')).toHaveTextContent(I.closed)
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(codeMemoryOf(mounted.queryClient).held).toBeNull()
    expect(screen.getByTestId('pd-issue')).toBeInTheDocument()
  })

  it('cancelled elsewhere (`CANCELLED` that this page did not send): the default Alert, the digits leave', async () => {
    const { bed, core } = await openPairedDevices()
    await issueMarker()
    const codeId = core.active!.codeId
    core.active = null
    await appendAuditRow(bed, { type: 'PAIRING_CODE_CLOSED', details: { codeId, reason: 'CANCELLED' } })
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'CANCELLED_ELSEWHERE'))
    expect(screen.getByTestId('pd-code-cancelled')).toHaveTextContent(I.cancelled)
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
  })

  it('replaced by an issue elsewhere (`admin.changed` PAIRING_CODE): Active, code not known, and the digits leave', async () => {
    const { bed, core, mounted } = await openPairedDevices()
    await issueMarker()
    core.active = { codeId: 'PCD-000900', code: '000000', issuedBy: 'OPR-004', issuedAt: bed.fake.clock.now(), expiresAt: bed.fake.clock.now() + CODE_LIFETIME_MS, attemptsRemaining: 5 }
    await act(async () => {
      bed.core.adminChanged('PAIRING_CODE')
    })
    await bed.flush()
    await waitFor(() => expect(panel()).toHaveAttribute('data-state', 'ACTIVE_UNKNOWN'))
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(codeMemoryOf(mounted.queryClient).held).toBeNull()
    // The issuer is not in the replica's operators: the page names the operator ID.
    expect(screen.getByTestId('pd-code-active-elsewhere')).toHaveTextContent('issued by OPR-004')
  })

  it('the attempts left follow the status: a counted failure publishes `admin.changed` PAIRING_CODE', async () => {
    const { bed, core } = await openPairedDevices()
    await issueMarker()
    core.active = { ...core.active!, attemptsRemaining: 1 }
    await act(async () => {
      bed.core.adminChanged('PAIRING_CODE')
    })
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('pd-attempts')).toHaveTextContent('1 attempt left'))
  })
})

describe('refusals, outages and limits (AC-C-99, AC-C-48, LB-6, LB-10)', () => {
  it('a 403 of the issue, named by its `notPermitted` example: the denied toast names the Supervisor; no code, no Error state, the button idle', async () => {
    const { bed, mounted } = await openPairedDevices()
    bed.fake.answerOnce('issuePairingCode', bed.fake.example('issuePairingCode', 403, 'notPermitted'))
    await pressIssue()
    await waitFor(() => expect(toastsWith(DENIED)).toHaveLength(1))
    expect(toastsWith(DENIED)[0]).toContain(REQUIRES_SUPERVISOR)
    expect(screen.queryByTestId('pd-issue-error')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pd-code')).not.toBeInTheDocument()
    expect(screen.getByTestId('pd-issue')).not.toHaveAttribute('aria-busy')
    expect(screen.getByTestId('pd-issue')).not.toBeDisabled()
    expect(codeMemoryOf(mounted.queryClient).held).toBeNull()
    expect(webErrorSink.records().filter((record) => record.source.startsWith('features/paired-devices'))).toEqual([])
  })

  it('an outage: the presenter\'s offline toast and the panel\'s Error state with a Retry that issues again', async () => {
    const { bed, requests } = await openPairedDevices()
    bed.fake.failOnce('issuePairingCode')
    await pressIssue()
    await screen.findByTestId('pd-issue-error')
    expect(screen.getByTestId('pd-issue-error')).toHaveTextContent(I.error)
    await waitFor(() => expect(toastsWith(OFFLINE)).toHaveLength(1))
    expect(screen.queryByTestId('pd-issue')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-issue-retry'))
    })
    await waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))
    expect(requests('issuePairingCode')).toHaveLength(2)
    expect(screen.queryByTestId('pd-issue-error')).not.toBeInTheDocument()
  })

  it('a 429 is a limit: one warning toast with the seconds of `retry-after`, no Error state, no offline words, the button idle', async () => {
    const { bed } = await openPairedDevices()
    bed.fake.answerOnce('issuePairingCode', rateLimited(42))
    await pressIssue()
    await waitFor(() => expect(toastsWith(LIMITED(42))).toHaveLength(1))
    expect(toastsWith(OFFLINE)).toEqual([])
    expect(screen.queryByTestId('pd-issue-error')).not.toBeInTheDocument()
    expect(screen.getByTestId('pd-issue')).not.toHaveAttribute('aria-busy')
    expect(panel()).toHaveAttribute('data-state', 'IDLE')
  })

  it('a refused cancel (403 by `notPermitted`) keeps the code on screen and names the role; an outage keeps it too', async () => {
    const { bed, mounted, requests } = await openPairedDevices()
    await issueMarker()
    bed.fake.answerOnce('cancelPairingCode', bed.fake.example('cancelPairingCode', 403, 'notPermitted'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-cancel-code'))
    })
    await waitFor(() => expect(toastsWith(DENIED)).toHaveLength(1))
    expect(panel()).toHaveAttribute('data-state', 'ACTIVE_KNOWN')
    expect(codeMemoryOf(mounted.queryClient).held?.code).toBe(MARKER_CODE)
    await waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))

    bed.fake.failOnce('cancelPairingCode')
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-cancel-code'))
    })
    await waitFor(() => expect(toastsWith(OFFLINE)).toHaveLength(1))
    expect(panel()).toHaveAttribute('data-state', 'ACTIVE_KNOWN')
    expect(codeMemoryOf(mounted.queryClient).held?.code).toBe(MARKER_CODE)
    await waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))
    expect(toastsWith(en.pairedDevices.toasts.cancelled)).toEqual([])
    expect(requests('issuePairingCode')).toHaveLength(1)
    expect(requests('cancelPairingCode')).toHaveLength(2)
  })

  it('a 500 of the cancel is worded by the presenter (UNAVAILABLE); the code stays, and no record holds it', async () => {
    const { bed } = await openPairedDevices()
    await issueMarker()
    bed.fake.answerOnce('cancelPairingCode', { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Internal error.' } } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('pd-cancel-code'))
    })
    await waitFor(() => expect(toastsWith(en.common.coreErrors.unavailable)).toHaveLength(1))
    expect(panel()).toHaveAttribute('data-state', 'ACTIVE_KNOWN')
    expect(JSON.stringify(webErrorSink.records())).not.toContain(MARKER_CODE)
  })
})

describe('pending and StrictMode (LB-1; row W0 §15)', () => {
  it('busy at once with the busy mark; a second press sends nothing; the kit\'s spinner after the reveal time', async () => {
    const { bed, requests } = await openPairedDevices()
    const held = bed.fake.hold('issuePairingCode')
    await pressIssue()
    const button = screen.getByTestId('pd-issue')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('data-busy', 'true')
    expect(button).not.toHaveAttribute('data-pending')
    await pressIssue()
    await bed.flush()
    expect(requests('issuePairingCode')).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('pd-issue')).toHaveAttribute('data-pending', 'true'))
    await act(async () => {
      held.release({
        status: 201,
        body: { codeId: 'PCD-000101', code: MARKER_CODE, qrPayload: MARKER_QR, issuedAt: bed.fake.clock.now(), expiresAt: bed.fake.clock.now() + CODE_LIFETIME_MS, attemptsAllowed: 5 },
      })
    })
    await bed.flush()
    await waitFor(() => expect(shownDigits()).toBe(MARKER_CODE))
    expect(requests('issuePairingCode')).toHaveLength(1)
  })

  it('under StrictMode (as `main.tsx` renders): one request per read at mount, none of a command, and one per press', async () => {
    const { requests } = await openPairedDevices({ mount: { strict: true } })
    expect(requests('getPairingCodeStatus')).toHaveLength(1)
    expect(requests('listPairedDevices')).toHaveLength(1)
    expect(requests('issuePairingCode')).toHaveLength(0)
    expect(requests('cancelPairingCode')).toHaveLength(0)
    await issueMarker()
    expect(requests('issuePairingCode')).toHaveLength(1)
  })

  it('the status entry of the cache never holds the code (its key is `CORE_QUERY_KEYS.pairingCode`)', async () => {
    const { mounted } = await openPairedDevices()
    await issueMarker()
    await waitFor(() => expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.pairingCode)).toMatchObject({ active: { codeId: 'PCD-000101' } }))
    expect(JSON.stringify(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.pairingCode))).not.toContain(MARKER_CODE)
  })
})
