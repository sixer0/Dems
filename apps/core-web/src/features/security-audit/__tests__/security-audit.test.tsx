// Step 51: Security & Audit page (masterplan/01_specs.md §14.5.7; AC-55 UI path; AC-48; AC-66).
// Every UI test builds the real router around its own simulator (as routes.test.tsx does), with a
// manual clock at 2026-10-01 10:00 WIB so the dataset joins the DEMO packages (step 93 --as-of),
// in-memory storage and no engine ticks: the tests drive state through the simulator's actions.
import { act, cleanup, fireEvent, render, screen, waitFor, within, configure } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@dems/shared/api'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  appendAudit,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  EXPORT_REASON_MIN_LENGTH,
  OPERATOR_IDS,
  verifyAuditChain,
  type AuditLogSlice,
  type Sim,
} from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createAppRouter } from '@/router'
import {
  buildControls,
  isTamperRow,
  matchesOperator,
  roleFor,
  stripBlocks,
  verifyChain,
  NO_OPERATOR,
} from '../model'
import { commonName, exportAuditWithReason, guardedPackageOf, keyEntries, packageIntegrity } from '../sim-adapter'
import { en } from '@dems/shared/i18n'

describe("Security & Audit: the chain, the controls, the page", () => {
  const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')

  const health: HealthResponse = {
    status: 'ok',
    service: 'dems-mock-core',
    version: '0.1.0',
    apiVersion: 'v1',
    serverTime: '2026-10-01T03:00:00.000Z',
    uptimeMs: 1000,
    ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
  }

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

  const sims: Sim[] = []

  function makeSim(operatorId: string | null = OPERATOR_IDS.BUDI): Sim {
    const authStorage = createMemoryAuthStorage()
    if (operatorId) authStorage.save({ operatorId, issuedAt: DEMO_NOW })
    const sim = createSim({
      storage: null,
      authStorage,
      visibility: ALWAYS_VISIBLE,
      clock: createManualClock(DEMO_NOW),
      scheduler: () => () => undefined,
    })
    sims.push(sim)
    return sim
  }

  async function mountPage(operatorId: string = OPERATOR_IDS.BUDI): Promise<Sim> {
    const sim = makeSim(operatorId)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createAppRouter(
      { sim, queryClient, socketFactory: () => new SilentSocket() },
      { history: createMemoryHistory({ initialEntries: ['/security-audit'] }) },
    )
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-security-audit', {}, { timeout: 10_000 })
    // The audit table, the lenses and access control mount in two transitions (staged mount).
    await screen.findByTestId('panel-rbac', {}, { timeout: 10_000 })
    return sim
  }

  // React Aria's Virtualizer treats an unmocked jsdom viewport as infinite and renders every row;
  // a 600 × 1600 viewport makes it virtualise like the browser (about 15 rows), which also keeps
  // these page tests fast.
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1600 })
  })
  afterAll(() => {
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
  })

  /** The audit panel's "shown of total" subtitle. */
  function auditCount(): string {
    return screen.getByTestId('panel-audit').querySelector('.sa-card-subtitle')?.textContent ?? ''
  }

  Element.prototype.scrollTo ??= function scrollTo() {}
  Element.prototype.scrollIntoView ??= function scrollIntoView() {}
  window.scrollTo = (() => undefined) as typeof window.scrollTo

  beforeEach(() => {
    resetMissingI18nKeys()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(health), { status: 200 })))
  })

  afterEach(() => {
    cleanup()
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
  })

  // ── Model: the chain check mirrors the simulator's verifyAuditChain (AC-55) ───────────────
  describe('verifyChain (model)', () => {
    it('passes the pristine chain with every row linked, like verifyAuditChain', () => {
      const sim = makeSim()
      const log = sim.store.getState().audit
      const report = verifyChain(log)
      const reference = verifyAuditChain(log)
      expect(reference.ok).toBe(true)
      expect(report.ok).toBe(true)
      expect(report.checked).toBe(reference.checked)
      expect(report.breakIndex).toBeNull()
      expect(report.statuses.every((status) => status === 'LINKED')).toBe(true)
      expect(verifyChain(log)).toBe(report) // cached per audit slice
    })

    it('reports the tampered index of AUDIT_TAMPER exactly where the simulator does (default and targeted)', () => {
      const sim = makeSim()
      act(() => sim.actions.inject('AUDIT_TAMPER'))
      const tampered = sim.store.getState().audit
      const reference = sim.actions.verifyAuditChain()
      const report = verifyChain(tampered)
      expect(reference.ok).toBe(false)
      if (reference.ok) return
      expect(report.ok).toBe(false)
      expect(report.breakIndex).toBe(reference.index)
      expect(report.breakSeq).toBe(reference.seq)
      expect(report.reason).toBe(reference.reason)
      expect(report.statuses.filter((status) => status === 'BROKEN')).toHaveLength(1)
      expect(report.statuses[reference.index]).toBe('BROKEN')

      const other = makeSim()
      act(() => other.actions.inject('AUDIT_TAMPER', { auditIndex: 3 }))
      const otherReport = verifyChain(other.store.getState().audit)
      expect(otherReport.breakIndex).toBe(3)
      expect(otherReport.breakIndex).toBe((other.actions.verifyAuditChain() as { index: number }).index)
    })

    it('flags a sequence gap, a broken link and a head mismatch in the simulator order', () => {
      const sim = makeSim()
      const log = sim.store.getState().audit
      const rows = log.rows.slice()
      const gap: AuditLogSlice = { ...log, rows: [...rows.slice(0, 10), ...rows.slice(11)] }
      const gapReport = verifyChain(gap)
      const gapReference = verifyAuditChain(gap)
      expect(gapReport.breakIndex).toBe((gapReference as { index: number }).index)
      expect(gapReport.reason).toBe((gapReference as { reason: string }).reason)

      const head: AuditLogSlice = { ...log, head: 'f'.repeat(64) }
      const headReport = verifyChain(head)
      expect(headReport.ok).toBe(false)
      expect(headReport.breakIndex).toBe(rows.length - 1)
      expect(headReport.reason).toBe('HASH_MISMATCH')
    })

    it('keeps an old break visible in the strip in front of the last blocks', () => {
      const sim = makeSim()
      act(() => sim.actions.inject('AUDIT_TAMPER', { auditIndex: 2 }))
      const log = sim.store.getState().audit
      const blocks = stripBlocks(log.rows, verifyChain(log), 12)
      expect(blocks).toHaveLength(12)
      expect(blocks[0]?.index).toBe(2)
      expect(blocks[0]?.status).toBe('BROKEN')
      expect(blocks[1]?.gapBefore).toBe(true)
      expect(blocks[11]?.row.seq).toBe(log.rows[log.rows.length - 1]?.seq)
    })
  })

  describe('controls, RBAC and adapters (model)', () => {
    it('builds nine controls: all active when pristine, hash chain failed after a tamper, RTC holdover needs attention', () => {
      const sim = makeSim()
      const state = sim.store.getState()
      const base = {
        security: state.security,
        time: { source: state.time.source, locked: state.time.locked },
        chain: { ok: true, breakSeq: null },
        softwareVersion: '2.4.1',
        signatureAlgorithm: 'Ed25519',
        ready: true,
      }
      const pristine = buildControls(base)
      expect(pristine).toHaveLength(9)
      expect(pristine.every((control) => control.status === 'OK')).toBe(true)
      const broken = buildControls({ ...base, chain: { ok: false, breakSeq: 78 } })
      expect(broken.find((control) => control.id === 'HASH_CHAIN')?.status).toBe('FAIL')
      const rtc = buildControls({ ...base, time: { source: 'RTC', locked: false } })
      expect(rtc.find((control) => control.id === 'SECURE_TIMESTAMP')?.status).toBe('ATTENTION')
      expect(buildControls({ ...base, ready: false }).every((control) => control.status === 'UNKNOWN')).toBe(true)
    })

    it('names the Supervisor as the role that may export the audit log (S20)', () => {
      expect(roleFor('AUDIT_EXPORT')).toBe('SUPERVISOR')
      expect(matchesOperator({ actorId: null }, NO_OPERATOR)).toBe(true)
      expect(matchesOperator({ actorId: 'OPR-001' }, NO_OPERATOR)).toBe(false)
    })

    it('a short export reason gets the simulator\'s 422 (no audit row); a valid one is recorded in AUDIT_EXPORTED (W51-1)', () => {
      const sim = makeSim(OPERATOR_IDS.ANDI)
      const before = sim.store.getState().audit.total
      const short = exportAuditWithReason(sim, 'x'.repeat(EXPORT_REASON_MIN_LENGTH - 1))
      expect(short).toEqual({ ok: false, status: 422, reason: 'INVALID_REASON' })
      expect(sim.store.getState().audit.total).toBe(before)
      const ok = exportAuditWithReason(sim, 'Quarterly audit review')
      expect(ok.ok).toBe(true)
      if (!ok.ok) return
      expect(ok.receipt.exportId).toMatch(/^EXP-/)
      expect(ok.receipt.entries).toBe(before)
      expect(ok.receipt.chainOk).toBe(true)
      expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'AUDIT_EXPORTED', details: { reason: 'Quarterly audit review' } })
    })

    it('shows the DEMO Ed25519 device certificate; the simulator lists the same algorithm since step 54 (W1, D67)', () => {
      const sim = makeSim()
      const entries = keyEntries(sim.store.getState().security.keys, 'TPM 2.0 (fw 7.2.3.1)')
      const cert = entries.find((entry) => entry.id === 'DEVICE_CERT')
      expect(cert?.algorithm).toBe('Ed25519')
      expect(sim.store.getState().security.keys.find((key) => key.id === 'DEVICE_CERT')?.algorithm).toBe('Ed25519')
      expect(cert?.source).toBe('DEMO_PACKAGE')
      expect(cert?.subject).toBe('DEMS-IR-01')
      expect(entries.find((entry) => entry.id === 'TLS_SERVER')?.source).toBe('SIMULATED')
      expect(commonName('CN=DEMS-IR-01 (DEMO — NOT FOR PRODUCTION), OU=x')).toBe('DEMS-IR-01')
    })

    it('summarises the DEMO packages with the case-and-subject guard (EV 0005 fails on AUDIO-02)', () => {
      const sim = makeSim()
      const evidence = sim.store.getState().evidence
      const integrity = packageIntegrity(evidence)
      expect(integrity.fail).toBe(1)
      expect(integrity.failures[0]?.failed).toEqual(['AUDIO-02'])
      expect(integrity.failures[0]?.evidenceId).toMatch(/-0005$/)
      expect(integrity.pass + integrity.fail).toBe(evidence.length)
      expect(integrity.label).toMatch(/DEMO/)
      const item = evidence[0]
      expect(item && guardedPackageOf({ ...item, subjectName: 'Someone else' })).toBeNull()
    })

    it('classifies tamper rows (EVT-12, EVT-30, verify failures)', () => {
      const sim = makeSim()
      act(() => sim.actions.inject('AUDIT_TAMPER'))
      act(() => sim.actions.inject('TAMPER'))
      const rows = sim.store.getState().audit.rows
      expect(rows.filter(isTamperRow).map((row) => row.type)).toEqual(['AUDIT_CHAIN_DISCONTINUITY', 'FAULT_RAISED'])
    })
  })

  // ── Page ──────────────────────────────────────────────────────────────────────────────────
  // Page tests render the whole routed page in jsdom (two staged transitions); they get a longer
  // timeout than the 5 s default because up to 16 parallel agents share this machine (D71/D72).
  describe('SecurityAuditPage', { timeout: 45_000 }, () => {
    it('renders the page, the header banner and every §14.5.7 panel with no missing i18n key (AC-48, AC-66)', async () => {
      await mountPage()
      for (const id of [
        'page-header',
        'security-banner',
        'panel-posture',
        'panel-controls',
        'panel-keys',
        'panel-chain',
        'panel-audit',
        'panel-auth',
        'panel-tamper',
        'panel-custody',
        'panel-rbac',
        'audit-table',
        'chain-strip',
        'rbac-matrix',
      ]) {
        expect(screen.getByTestId(id), id).toBeInTheDocument()
      }
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SECURITY & AUDIT')
      expect(screen.getByTestId('security-banner')).toHaveAttribute('data-state', 'SECURE')
      expect(screen.getByTestId('chain-status')).toHaveAttribute('data-chain-status', 'PASS')
      expect(screen.getByTestId('posture-state')).toHaveTextContent('SECURE')
      expect(within(screen.getByTestId('panel-controls')).getAllByRole('option')).toHaveLength(9)
      expect(screen.getByTestId('chain-strip').querySelectorAll('[data-seq]')).toHaveLength(12)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('AC-55 UI path: after inject AUDIT_TAMPER the chain view reports FAIL at the tampered index', async () => {
      const sim = await mountPage()
      act(() => sim.actions.inject('AUDIT_TAMPER'))
      const reference = sim.actions.verifyAuditChain()
      expect(reference.ok).toBe(false)
      if (reference.ok) return

      const status = await screen.findByTestId('chain-status')
      await waitFor(() => expect(status).toHaveAttribute('data-chain-status', 'FAIL'))
      expect(status).toHaveAttribute('data-break-index', String(reference.index))
      expect(status).toHaveAttribute('data-break-seq', String(reference.seq))

      const alert = await screen.findByTestId('chain-discontinuity')
      expect(alert).toHaveTextContent(`breaks at entry #${reference.seq}`)
      const block = screen.getByTestId('chain-strip').querySelector(`[data-seq="${reference.seq}"]`)
      expect(block).toHaveAttribute('data-chain', 'BROKEN')
      const row = screen.getByTestId('audit-table').querySelector(`[data-seq="${reference.seq}"]`)
      expect(row).toHaveAttribute('data-chain', 'BROKEN')

      // Calm escalation (P7): banner and shield go CRITICAL; the hash-chain control fails.
      expect(screen.getByTestId('security-banner')).toHaveAttribute('data-state', 'CRITICAL')
      expect(screen.getByTestId('panel-posture').querySelector('[data-posture]')).toHaveAttribute('data-posture', 'CRITICAL')
      expect(screen.getByTestId('panel-controls').querySelector('[data-control="HASH_CHAIN"]')).toHaveAttribute('data-status', 'FAIL')

      // "Verify chain" runs the simulator's verifyAuditChain and shows FAIL (M-C-21).
      fireEvent.click(screen.getByTestId('verify-chain'))
      await waitFor(() => expect(screen.getByTestId('chain-verified')).toHaveAttribute('data-verified', 'FAIL'), { timeout: 8000 })

      // Clearing the fault restores the row: the chain reports PASS again and the alert leaves.
      act(() => sim.actions.clearFault('AUDIT_TAMPER'))
      await waitFor(() => expect(screen.getByTestId('chain-status')).toHaveAttribute('data-chain-status', 'PASS'))
      await waitFor(() => expect(screen.queryByTestId('chain-discontinuity')).not.toBeInTheDocument())
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('virtualises the audit table and filters it by search, type and live mode', async () => {
      const sim = await mountPage()
      const table = screen.getByTestId('audit-table')
      const total = sim.store.getState().audit.rows.length
      expect(auditCount()).toBe(`${total} of ${total} entries`)
      const rendered = table.querySelectorAll('[data-seq]').length
      expect(rendered).toBeGreaterThan(5)
      expect(rendered).toBeLessThan(total) // only the visible rows are in the DOM
      const newest = sim.store.getState().audit.rows.at(-1)?.seq
      expect(table.querySelector('[role="row"][data-seq]')).toHaveAttribute('data-seq', String(newest))

      const search = within(screen.getByTestId('audit-search')).getByRole('searchbox')
      fireEvent.change(search, { target: { value: 'evidence sealed' } })
      const sealed = sim.store.getState().audit.rows.filter((row) => row.type === 'EVIDENCE_SEALED').length
      await waitFor(() => expect(auditCount()).toBe(`${sealed} of ${total} entries`))
      fireEvent.change(search, { target: { value: '' } })
      await waitFor(() => expect(auditCount()).toBe(`${total} of ${total} entries`))

      // Type filter (category Select): Authentication rows only.
      fireEvent.click(within(screen.getByTestId('audit-filter-type')).getByRole('button'))
      fireEvent.click(await screen.findByRole('option', { name: 'Authentication' }))
      const auth = sim.store.getState().audit.rows.filter((row) => row.category === 'AUTH').length
      expect(auth).toBeGreaterThan(0)
      await waitFor(() => expect(auditCount()).toBe(`${auth} of ${total} entries`))
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      await waitFor(() => expect(auditCount()).toBe(`${total} of ${total} entries`))

      // Live off: new entries are held back and counted; back on, they appear.
      fireEvent.click(within(screen.getByTestId('audit-live')).getByRole('switch'))
      act(() => sim.actions.inject('FAN_STALL'))
      await waitFor(() => expect(screen.getByTestId('audit-held-back')).toHaveTextContent('1 new entry'))
      expect(auditCount()).toBe(`${total} of ${total + 1} entries`)
      fireEvent.click(within(screen.getByTestId('audit-live')).getByRole('switch'))
      await waitFor(() => expect(auditCount()).toBe(`${total + 1} of ${total + 1} entries`))
    })

    it('gates Export audit on AUDIT_EXPORT: disabled for the Investigator with the role named (S20)', async () => {
      await mountPage(OPERATOR_IDS.BUDI)
      const button = screen.getByTestId('export-audit')
      expect(button).toHaveAttribute('data-disabled', 'true')
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button.getAttribute('aria-label')).toContain('Requires the Supervisor role')
    })

    it('exports the audit log for the Supervisor with a mandatory reason and records the custody event', async () => {
      const sim = await mountPage(OPERATOR_IDS.ANDI)
      const before = sim.store.getState().audit.total
      fireEvent.click(screen.getByTestId('export-audit'))
      const dialog = await screen.findByTestId('export-audit-dialog')

      fireEvent.click(within(dialog).getByTestId('export-confirm'))
      expect(await within(dialog).findByText(/at least 5 characters/)).toBeInTheDocument()
      expect(sim.store.getState().audit.total).toBe(before)

      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Internal review by the unit head' } })
      fireEvent.click(within(dialog).getByTestId('export-confirm'))
      const result = await screen.findByTestId('export-audit-result', {}, { timeout: 12_000 })
      const last = sim.store.getState().audit.rows.at(-1)
      expect(last?.type).toBe('AUDIT_EXPORTED')
      expect(result).toHaveTextContent(String(last?.details.exportId))
      expect(result).toHaveTextContent('Internal review by the unit head')
      expect(sim.store.getState().audit.total).toBe(before + 1)
      await waitFor(() => expect(within(screen.getByTestId('panel-custody')).getAllByText(/Audit export/).length).toBeGreaterThan(0))
    })

    it('shows the DEMO Ed25519 certificate, the package verdicts and the three operators', async () => {
      await mountPage()
      const cert = screen.getByTestId('panel-keys').querySelector('[data-key="DEVICE_CERT"]')
      expect(cert).toHaveTextContent('Ed25519')
      expect(cert).toHaveTextContent('DEMO')
      expect(cert).not.toHaveTextContent('ECDSA')
      expect(screen.getByTestId('tamper-packages')).toHaveTextContent('12 PASS • 1 FAIL')
      expect(within(screen.getByTestId('panel-tamper')).getByText(/AUDIO-02 hash mismatch/)).toBeInTheDocument()
      const rbac = screen.getByTestId('panel-rbac')
      expect(rbac.querySelectorAll('[data-operator]')).toHaveLength(3)
      expect(rbac.querySelector('[data-operator="OPR-001"]')).toHaveAttribute('data-current', 'true')
      expect(await within(screen.getByTestId('rbac-matrix')).findAllByRole('row')).toHaveLength(10)
    })

    it('shows sign-in failures and the lockout in the authentication panel (§20.1)', async () => {
      const sim = await mountPage()
      act(() => {
        for (let attempt = 0; attempt < 5; attempt += 1) sim.actions.signIn('budi.santoso', 'wrong-password')
      })
      const lockout = await screen.findByTestId('auth-lockout')
      await waitFor(() => expect(lockout).toHaveTextContent(/Locked, \d+ s left/))
      expect(sim.store.getState().auth.operatorId).toBe(OPERATOR_IDS.BUDI) // a failed attempt never signs anyone out
      const feed = screen.getByTestId('auth-feed')
      expect(within(feed).getAllByText('Sign-in failed').length).toBeGreaterThan(0)
      expect(within(feed).getAllByText(/Unverified user|AKP Budi Santoso/).length).toBeGreaterThan(0)
    })

    it('appends a live row with the fresh highlight while Live is on (M-C-07)', async () => {
      const sim = await mountPage()
      act(() => {
        sim.store.setState((state) => ({
          ...state,
          audit: appendAudit(
            state.audit,
            { type: 'DIAGNOSTICS_RUN', message: 'Diagnostics run', actorId: OPERATOR_IDS.BUDI },
            state.clock.now,
          ).log,
        }))
      })
      const seq = sim.store.getState().audit.rows.at(-1)?.seq
      await waitFor(() => expect(screen.getByTestId('audit-table').querySelector(`[data-seq="${seq}"]`)).not.toBeNull())
      const row = screen.getByTestId('audit-table').querySelector(`[data-seq="${seq}"]`) as HTMLElement
      expect(row.querySelector('.sa-row-fresh')).not.toBeNull()
    })
  })
})

// Closing copy round (decision D176 DC-5, finding F75-7; W83 ledger #94): the one deliberate change
// of Simulated copy in the round. The audit export's result note in Simulated mode said the demo
// simulator "does not record the export reason yet"; the simulator records it since step 54 (W51-1).
// The note now says what is true, in the words of the Live note. The dialog renders the key itself
// (`export-audit-dialog.tsx`); `live-security-audit-export.test.tsx` shows it on screen in both modes.
describe("the result note of the audit export names the reason (Simulated mode)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  const NOW = Date.parse('2026-10-01T10:00:00+07:00')
  const sims: Sim[] = []

  afterEach(() => {
    for (const sim of sims.splice(0)) sim.stop()
  })

  /** A simulator with the Supervisor (AUDIT_EXPORT, OPR-002 as in `security-audit.test.tsx`) signed in; nothing runs on its own. */
  function supervisorSim(): Sim {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: NOW })
    const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, clock: createManualClock(NOW), scheduler: () => () => undefined })
    sims.push(sim)
    return sim
  }

  describe('the audit export\'s result note (Simulated mode)', () => {
    it('says the reason is recorded, in the words of the Live note, and no longer that it is not', () => {
      const note = en.securityAudit.exportAudit.result.reasonNote
      expect(note).toBe('Recorded by the simulator in the audit row of the export.')
      expect(note).not.toMatch(/does not record|not record|yet/i)
      // One wording across the two modes: only the recorder differs.
      expect(note.replace('the simulator', 'the Core')).toBe(en.securityAudit.live.exportAudit.reasonNote)
    })

    it('is true: the simulator writes the reason into the export\'s AUDIT_EXPORTED row', () => {
      const sim = supervisorSim()
      const result = exportAuditWithReason(sim, 'Quarterly audit review')
      expect(result.ok).toBe(true)
      expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'AUDIT_EXPORTED', details: { reason: 'Quarterly audit review' } })
    })
  })
})
