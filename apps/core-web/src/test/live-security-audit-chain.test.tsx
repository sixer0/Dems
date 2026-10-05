/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W75: the hash-chain panel of the Security & Audit page in Live mode — settle sites A9
// (`verifyAuditChain` → operation 60, `features/security-audit/chain-panel.tsx`), C-6 (the clock
// stamp) and B-5 (`acknowledgeAlert` → operation 70) — through the real router and the real Live
// source on the contract-checked fake transport; and the same panel in Simulated mode as the control
// group (backend task 04_client_integration_spec §8.2 A9, §8.3 B-5, §8.4 C-6, §8.1 LB-1 to LB-10,
// §6.2; AC-C-48, AC-C-109; SD-19; gate CLG (b) of 02_plan §11). The page of this file is
// `http://127.0.0.1:5178/`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | A9 success: the Spinner holds until the Core answered (LB-2); the chip is the check over the Core's audit VIEW; under it the stored-chain line (AC-C-109) | "A9 verify" |
// | A9 + SD-19: "Earlier chains: n" only when `lineage` is not empty, its list holds one entry per discarded chain the Core returned, with epoch, rows, head, time, operator and scenario | "A9 lineage" |
// | A9 during AUDIT_TAMPER: a broken view and an intact stored chain (01_specs §12.3) | "A9 verify" |
// | A9 refusal / outage: the presenter speaks (ORIGIN_NOT_ALLOWED: operation 60 needs only a signed-in operator, so NOT_PERMITTED cannot occur, ruling D154 DN-1); no result chip; the button is idle again | "A9 refusal and outage" |
// | C-6: the time stamp is the Live clock | "A9 verify" |
// | B-5: one POST of operation 70; busy at once, spinner late; the button leaves with the Core's delta; refusal and outage by the presenter | "B-5 acknowledge" |
// | AC-C-109, second half: the Simulated panel is as today (no stored line, no lineage) | "Simulated mode is unchanged" |
//
// Operations 60 and 70 have the access rule AUTHENTICATED: their documented 403 examples are
// `deviceRevoked` and `originNotAllowed` only. The refusal case of both sites is ORIGIN_NOT_ALLOWED.
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_API_EXAMPLES, type AuditChainStatus } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { LiveLinkState } from '@dems/shared/live'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import type { LivePage, LiveTestBed } from '@/runtime/testing/live-harness'
import {
  chainStatus,
  clearToasts,
  liveSecurityAudit,
  makeSim,
  simulatedSecurityAudit,
  stubViewport,
  toastTexts,
  toastWith,
} from '@/features/security-audit/__tests__/live-security-audit-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const C = en.securityAudit.chain
const LC = en.securityAudit.live.chain
const OFFLINE = en.common.coreErrors.offline
const ORIGIN_REFUSED = en.common.coreErrors.originNotAllowed.split('{{')[0]!
const STORED = (count: number) => LC.stored.replace('{{count}}', String(count))
const EARLIER = (count: number) => LC.earlier.replace('{{count}}', String(count))

const EXAMPLES = CORE_API_EXAMPLES.verifyAuditChain!.responses[200] as Record<string, { value: AuditChainStatus }>
const INTACT = EXAMPLES.intact!.value
const VIEW_TAMPERED = EXAMPLES.viewTampered!.value

let bed: LiveTestBed | undefined
let loaded: LivePage | undefined
let restoreViewport: () => void = () => undefined
const sims: Sim[] = []

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const records = (source: string) => webErrorSink.records().filter((record) => record.source === source)

async function live(options: Parameters<typeof liveSecurityAudit>[0] = {}) {
  const created = await liveSecurityAudit(options)
  bed = created.bed
  loaded = created.page
  return created
}

/** Presses Verify chain and waits for the request (it leaves when the Spinner's time is over). */
async function pressVerify(): Promise<void> {
  const before = requests('verifyAuditChain').length
  fireEvent.click(screen.getByTestId('verify-chain'))
  await waitFor(() => expect(requests('verifyAuditChain')).toHaveLength(before + 1), { timeout: 4_000 })
}

beforeAll(() => {
  restoreViewport = stubViewport()
})

afterAll(() => {
  restoreViewport()
})

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(async () => {
  // Brief list row 18 of implementation/44_live_source.md §17.4: no call site read a Live result as a value.
  const misuse = loaded?.sink.records().filter((record) => record.source === 'live.misuse') ?? []
  loaded = undefined
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  for (const sim of sims.splice(0)) sim.stop()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  expect(misuse.map((record) => `${record.level} ${record.message}`)).toEqual([])
})

describe('A9 verify (LB-2; §8.2 A9; C-6; AC-C-109)', () => {
  it('success: the Spinner holds until the Core answered; PASS from the view; the stored-chain line under it; no lineage line; the stamp is the Live clock', async () => {
    const { bed, page } = await live()
    const held = bed.fake.hold('verifyAuditChain')
    await pressVerify()
    expect(screen.getByTestId('verify-chain')).toHaveTextContent(C.verifying)
    expect(screen.getByTestId('verify-chain')).toBeDisabled()
    // A second press while the Core has not answered sends nothing.
    fireEvent.click(screen.getByTestId('verify-chain'))
    await bed.flush()
    expect(requests('verifyAuditChain')).toHaveLength(1)
    expect(screen.queryByTestId('chain-verified')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chain-core')).not.toBeInTheDocument()

    await act(async () => {
      held.release(bed.fake.example('verifyAuditChain', 200, 'intact'))
    })
    await bed.flush()
    await waitFor(() => expect(screen.getByTestId('chain-verified')).toHaveAttribute('data-verified', 'PASS'))
    expect(screen.getByTestId('chain-verified')).toHaveTextContent(`Verified ${INTACT.view.checked} entries`)
    // C-6: the Live clock (manual in this bed, so the stamp is exact).
    expect(screen.getByTestId('chain-verified')).toHaveTextContent(formatDate(page.live.clock.now(), DATE_PATTERNS.time))
    expect(screen.getByTestId('chain-stored')).toHaveTextContent(STORED(INTACT.stored.checked))
    expect(screen.getByTestId('chain-stored')).toHaveAttribute('data-stored', 'PASS')
    expect(screen.queryByTestId('chain-earlier')).not.toBeInTheDocument()
    expect(screen.getByTestId('verify-chain')).not.toBeDisabled()
    expect(requests('verifyAuditChain')[0]).toMatchObject({ method: 'GET', path: '/api/v1/audit/chain' })
    expect(toastTexts().join(' ')).not.toMatch(/simulat/i)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('AUDIT_TAMPER on the Core: the chip says FAIL (the view) while the stored-chain line says verified (the table)', async () => {
    const { bed } = await live()
    bed.fake.answerOnce('verifyAuditChain', bed.fake.example('verifyAuditChain', 200, 'viewTampered'))
    await pressVerify()
    await waitFor(() => expect(screen.getByTestId('chain-verified')).toHaveAttribute('data-verified', 'FAIL'))
    expect(screen.getByTestId('chain-stored')).toHaveAttribute('data-stored', 'PASS')
    expect(screen.getByTestId('chain-stored')).toHaveTextContent(STORED(VIEW_TAMPERED.stored.checked))
  })

  it('a stored chain that does not verify names its first bad entry', async () => {
    const { bed } = await live()
    bed.fake.answerOnce('verifyAuditChain', {
      status: 200,
      body: chainStatus(INTACT, { stored: { ok: false, checked: 40, head: INTACT.stored.head, firstBadSeq: 41 } }),
    })
    await pressVerify()
    await waitFor(() => expect(screen.getByTestId('chain-stored')).toHaveAttribute('data-stored', 'FAIL'))
    expect(screen.getByTestId('chain-stored')).toHaveTextContent(LC.storedBroken.replace('{{seq}}', '41').replace('{{checked}}', '40'))
  })
})

describe('A9 lineage (SD-19; AC-C-109)', () => {
  it('one discarded chain (the contract example): "Earlier chains: 1" opens a read-only list with its epoch, rows, head, time, operator and scenario', async () => {
    const { bed, page } = await live()
    bed.fake.answerOnce('verifyAuditChain', bed.fake.example('verifyAuditChain', 200, 'viewTampered'))
    await pressVerify()
    const earlier = await screen.findByTestId('chain-earlier')
    expect(earlier).toHaveTextContent(EARLIER(1))
    fireEvent.click(earlier)
    const list = await screen.findByTestId('chain-earlier-list')
    const entries = within(list).getAllByTestId('chain-earlier-entry')
    expect(entries).toHaveLength(1)
    const [entry] = VIEW_TAMPERED.lineage
    expect(entries[0]).toHaveAttribute('data-epoch', String(entry!.epoch))
    expect(entries[0]).toHaveTextContent(`Epoch ${entry!.epoch} • ${entry!.rows} rows • head ${entry!.head.slice(0, 12)}`)
    const andi = page.live.store.getState().operators.find((operator) => operator.id === entry!.actorId)
    expect(andi).toBeDefined()
    expect(entries[0]).toHaveTextContent(`Reset at ${formatDate(entry!.resetAt, DATE_PATTERNS.dateTime)} by ${andi!.displayName} • scenario Idle`)
    expect(within(list).queryByTestId('chain-earlier-shown')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('three of 25 discarded chains: one entry per chain the Core returned, newest first, and the count of all; a command-line reset names no operator', async () => {
    const { bed } = await live()
    const lineage: AuditChainStatus['lineage'] = [
      { epoch: 25, rows: 140, head: 'a'.repeat(64), resetAt: bed.fake.clock.now() - 60_000, actorId: 'OPR-002', scenario: 'recording', reason: 'SCENARIO_LOAD' },
      { epoch: 24, rows: 97, head: 'b'.repeat(64), resetAt: bed.fake.clock.now() - 120_000, actorId: null, scenario: 'idle', reason: 'RESET' },
      { epoch: 23, rows: 82, head: 'c'.repeat(64), resetAt: bed.fake.clock.now() - 180_000, actorId: 'OPR-002', scenario: 'fault-demo', reason: 'SCENARIO_LOAD' },
    ]
    bed.fake.answerOnce('verifyAuditChain', { status: 200, body: chainStatus(INTACT, { lineage, lineageTotal: 25 }) })
    await pressVerify()
    const earlier = await screen.findByTestId('chain-earlier')
    expect(earlier).toHaveTextContent(EARLIER(25))
    fireEvent.click(earlier)
    const list = await screen.findByTestId('chain-earlier-list')
    const entries = within(list).getAllByTestId('chain-earlier-entry')
    expect(entries.map((element) => element.getAttribute('data-epoch'))).toEqual(['25', '24', '23'])
    expect(entries[0]).toHaveTextContent('Scenario load at')
    expect(entries[0]).toHaveTextContent('scenario Recording')
    expect(entries[1]).toHaveTextContent(`Reset at ${formatDate(lineage[1]!.resetAt, DATE_PATTERNS.dateTime)} by ${LC.commandLine}`)
    expect(entries[2]).toHaveTextContent('scenario Fault demo')
    expect(within(list).getByTestId('chain-earlier-shown')).toHaveTextContent('The newest 3 of 25 are listed.')
    // The stored chain is still its own line.
    expect(screen.getByTestId('chain-stored')).toHaveTextContent(STORED(INTACT.stored.checked))
  })

  it('an empty lineage shows no "Earlier chains" line', async () => {
    const { bed } = await live()
    bed.fake.answerOnce('verifyAuditChain', { status: 200, body: chainStatus(INTACT, { lineage: [], lineageTotal: 0 }) })
    await pressVerify()
    await screen.findByTestId('chain-stored')
    expect(screen.queryByTestId('chain-earlier')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Earlier chains')
  })
})

describe('A9 refusal and outage (§6.2; LB-6; LB-10)', () => {
  it('refusal: the documented 403 (ORIGIN_NOT_ALLOWED) is worded by the presenter with the address; no result, no line; Verify is idle again', async () => {
    const { bed } = await live()
    bed.fake.answerOnce('verifyAuditChain', bed.fake.example('verifyAuditChain', 403, 'originNotAllowed'))
    await pressVerify()
    await waitFor(() => expect(toastWith(ORIGIN_REFUSED)).toHaveLength(1))
    expect(toastWith(ORIGIN_REFUSED)[0]).toContain('http://127.0.0.1:5178')
    await waitFor(() => expect(screen.getByTestId('verify-chain')).not.toBeDisabled())
    expect(screen.getByTestId('verify-chain')).toHaveTextContent(C.verify)
    expect(screen.queryByTestId('chain-verified')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chain-core')).not.toBeInTheDocument()
    expect(records('SecurityAudit.ChainPanel.verify')).toHaveLength(0)
  })

  it('outage: the presenter\'s sentence once; no result chip, no page toast, no page record', async () => {
    const { bed } = await live()
    bed.fake.failOnce('verifyAuditChain')
    await pressVerify()
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(LC.verifyFailed)).toHaveLength(0)
    expect(toastWith(en.common.errors.generic)).toHaveLength(0)
    await waitFor(() => expect(screen.getByTestId('verify-chain')).not.toBeDisabled())
    expect(screen.queryByTestId('chain-verified')).not.toBeInTheDocument()
    expect(records('SecurityAudit.ChainPanel.verify')).toHaveLength(0)
  })

  it('with the link down the check is refused without a request; the presenter says so once', async () => {
    const { bed, page } = await live()
    bed.core.unreachable()
    await bed.flush()
    expect(page.live.link).toBe(LiveLinkState.OFFLINE)
    fireEvent.click(screen.getByTestId('verify-chain'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1), { timeout: 4_000 })
    expect(requests('verifyAuditChain')).toHaveLength(0)
    await waitFor(() => expect(screen.getByTestId('verify-chain')).not.toBeDisabled())
  })
})

// ── B-5: Acknowledge on the discontinuity Alert (an AUDIT_TAMPER on the Core) ─────────────────

/** The Core's state with the demo fault AUDIT_TAMPER: a tampered ring row and its active alert. */
function tampered(): Sim {
  const sim = makeSim(OPERATOR_IDS.ANDI, (created) => created.actions.inject('AUDIT_TAMPER'))
  sims.push(sim)
  return sim
}
type Ops = FakeCommandOptions['ops']
const acknowledgedDelta = (core: Sim): Ops => {
  const alerts = core.store.getState().alerts.map((alert) => (alert.kind === 'AUDIT_TAMPER' ? { ...alert, acknowledged: true } : alert))
  return [{ op: 'replace', slice: 'alerts', value: JSON.parse(JSON.stringify(alerts)) }] as Ops
}
const tamperAlertId = (core: Sim): string => core.store.getState().alerts.find((alert) => alert.kind === 'AUDIT_TAMPER' && alert.active)!.id

describe('B-5 acknowledge (§8.3 B-5; LB-1; §6.2)', () => {
  it('success: one POST of operation 70 for the tamper alert; the toast after the answer; the button leaves with the Core\'s delta', async () => {
    const core = tampered()
    const { bed } = await live({ served: () => core.store.getState() })
    const alertId = tamperAlertId(core)
    await screen.findByTestId('chain-discontinuity')
    bed.fake.scriptCommand('acknowledgeAlert', { ops: acknowledgedDelta(core), order: 'delta-first' })
    fireEvent.click(screen.getByTestId('chain-acknowledge'))
    await waitFor(() => expect(toastWith(C.acknowledged)).toHaveLength(1))
    expect(requests('acknowledgeAlert')).toHaveLength(1)
    expect(requests('acknowledgeAlert')[0]).toMatchObject({ method: 'POST', path: `/api/v1/alerts/${alertId}/acknowledge` })
    await waitFor(() => expect(screen.queryByTestId('chain-acknowledge')).not.toBeInTheDocument())
    // The break stays on record: the Alert itself stays while the Core's ring is broken.
    expect(screen.getByTestId('chain-discontinuity')).toBeInTheDocument()
    expect(records('SecurityAudit.ChainPanel.acknowledge')).toHaveLength(0)
  })

  it('pending: busy at once with the same look, a second press sends nothing, the spinner only after the reveal time', async () => {
    const core = tampered()
    const { bed } = await live({ served: () => core.store.getState() })
    await screen.findByTestId('chain-discontinuity')
    const held = bed.fake.hold('acknowledgeAlert')
    const button = screen.getByTestId('chain-acknowledge')
    fireEvent.click(button)
    await waitFor(() => expect(requests('acknowledgeAlert')).toHaveLength(1))
    await bed.flush()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).not.toHaveAttribute('data-pending')
    fireEvent.click(button)
    await bed.flush()
    expect(requests('acknowledgeAlert')).toHaveLength(1)
    await waitFor(() => expect(button).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    expect(button.querySelector('[data-slot="spinner"], svg')).not.toBeNull()
    expect(toastWith(C.acknowledged)).toHaveLength(0)
    await act(async () => {
      held.release({ status: 204 })
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(C.acknowledged)).toHaveLength(1))
    expect(requests('acknowledgeAlert')).toHaveLength(1)
  })

  it('refusal: the documented 403 (ORIGIN_NOT_ALLOWED) by the presenter; no success toast; the button is idle and still offered', async () => {
    const core = tampered()
    const { bed } = await live({ served: () => core.store.getState() })
    await screen.findByTestId('chain-discontinuity')
    bed.fake.answerOnce('acknowledgeAlert', bed.fake.example('acknowledgeAlert', 403, 'originNotAllowed'))
    fireEvent.click(screen.getByTestId('chain-acknowledge'))
    await waitFor(() => expect(toastWith(ORIGIN_REFUSED)).toHaveLength(1))
    expect(toastWith(C.acknowledged)).toHaveLength(0)
    const button = screen.getByTestId('chain-acknowledge')
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'))
    expect(button).not.toBeDisabled()
    expect(records('SecurityAudit.ChainPanel.acknowledge')).toHaveLength(0)
  })

  it('outage: the presenter\'s sentence; no success toast; the button stays', async () => {
    const core = tampered()
    const { bed } = await live({ served: () => core.store.getState() })
    await screen.findByTestId('chain-discontinuity')
    bed.fake.failOnce('acknowledgeAlert')
    fireEvent.click(screen.getByTestId('chain-acknowledge'))
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastWith(C.acknowledged)).toHaveLength(0)
    await waitFor(() => expect(screen.getByTestId('chain-acknowledge')).not.toHaveAttribute('aria-busy'))
    expect(records('SecurityAudit.ChainPanel.acknowledge')).toHaveLength(0)
  })
})

// ── The control group: the same panel in Simulated mode ──────────────────────────────────────

describe('Simulated mode is unchanged (CLG (a); AC-C-109 second half)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  })

  it('Verify runs the simulator\'s check: PASS, and no stored-chain line, no "Earlier chains" line', async () => {
    const sim = makeSim(OPERATOR_IDS.BUDI)
    sims.push(sim)
    await simulatedSecurityAudit(sim)
    fireEvent.click(screen.getByTestId('verify-chain'))
    await waitFor(() => expect(screen.getByTestId('chain-verified')).toHaveAttribute('data-verified', 'PASS'))
    expect(screen.getByTestId('chain-verified')).toHaveTextContent(`Verified ${sim.store.getState().audit.rows.length} entries`)
    expect(screen.queryByTestId('chain-core')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chain-stored')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chain-earlier')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Stored chain')
  })

  it('Acknowledge settles in the press: the store changes at once, the toast shows, never busy', async () => {
    const sim = tampered()
    await simulatedSecurityAudit(sim)
    await screen.findByTestId('chain-discontinuity')
    const button = screen.getByTestId('chain-acknowledge')
    fireEvent.click(button)
    expect(sim.store.getState().alerts.find((alert) => alert.kind === 'AUDIT_TAMPER')?.acknowledged).toBe(true)
    expect(button).not.toHaveAttribute('aria-busy')
    await waitFor(() => expect(toastWith(C.acknowledged)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByTestId('chain-acknowledge')).not.toBeInTheDocument())
  })
})
