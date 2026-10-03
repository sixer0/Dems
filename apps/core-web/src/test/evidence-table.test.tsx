// AC-64 (masterplan/01_specs.md §14.13, §14.14; blueprint row 47, RL-31): the Evidence table filters
// by status, paginates at 10 per page and searches the evidence ID, case number and subject. The
// fixture is the simulator's own dataset: 13 evidence items (D61), so page 2 exists (≥ 11 rows).
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EvidenceStatus, selectEvidenceStats } from '@dems/shared/sim'
import { matchesSearch, withinDateRange } from '@/features/evidence/model'
import { findPage, installBrowserStubs, mountEvidence, stopSims } from '@/features/evidence/__tests__/harness'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'

function tableRows(): HTMLElement[] {
  return Array.from(screen.getByTestId('evidence-table').querySelectorAll<HTMLElement>('tr[data-row-id]'))
}

function rowIds(): string[] {
  return tableRows().map((row) => row.dataset.rowId ?? '')
}

function rowStatuses(): string[] {
  return tableRows().map((row) => row.querySelector<HTMLElement>('[data-evidence-status]')?.dataset.evidenceStatus ?? '')
}

beforeEach(() => {
  resetMissingI18nKeys()
  installBrowserStubs()
})

afterEach(() => {
  cleanup()
  stopSims()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('evidence table (AC-64)', () => {
  it('uses a fixture of at least 11 rows and paginates 10 per page', async () => {
    const { sim, router } = mountEvidence('/evidence')
    await findPage('page-evidence')
    const total = sim.store.getState().evidence.length
    expect(total).toBeGreaterThanOrEqual(11)
    expect(total).toBe(13)

    await waitFor(() => expect(tableRows()).toHaveLength(10))
    expect(screen.getByTestId('evidence-page-summary')).toHaveTextContent(`1–10 of ${total}`)
    const firstPage = rowIds()

    fireEvent.click(screen.getByTestId('evidence-page-2'))
    await waitFor(() => expect(tableRows()).toHaveLength(total - 10))
    expect(router.state.location.search).toMatchObject({ page: 2 })
    expect(screen.getByTestId('evidence-page-summary')).toHaveTextContent(`11–${total} of ${total}`)
    // Page 2 holds the remaining items, none repeated from page 1 (newest first overall).
    expect(rowIds().some((id) => firstPage.includes(id))).toBe(false)
    expect(new Set([...firstPage, ...rowIds()]).size).toBe(total)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('status filter Sealed shows only sealed rows (toggle and URL)', async () => {
    const { sim, router } = mountEvidence('/evidence')
    await findPage('page-evidence')
    const sealed = selectEvidenceStats(sim.store.getState()).sealed
    expect(sealed).toBe(10)

    const group = screen.getByTestId('evidence-status-filter')
    fireEvent.click(within(group).getByRole('radio', { name: /^Sealed/ }))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ status: EvidenceStatus.SEALED }))
    await waitFor(() => expect(rowStatuses().every((status) => status === 'SEALED')).toBe(true))
    expect(tableRows()).toHaveLength(Math.min(10, sealed))
    expect(screen.getByTestId('evidence-page-summary')).toHaveTextContent(`of ${sealed}`)

    cleanup()
    mountEvidence('/evidence?status=EXPORTED')
    await findPage('page-evidence')
    await waitFor(() => expect(rowStatuses()).toEqual(['EXPORTED']))
  })

  it('search matches the evidence ID, the case number and the subject', async () => {
    const { router } = mountEvidence('/evidence')
    await findPage('page-evidence')
    const input = screen.getByTestId('evidence-search')

    // By evidence ID (the harness pins the simulator clock to the DEMO dataset instant).
    fireEvent.change(input, { target: { value: 'EV-20260930-0005' } })
    await waitFor(() => expect(rowIds()).toEqual(['EV-20260930-0005']))
    expect(router.state.location.search).toMatchObject({ q: 'EV-20260930-0005' })

    // A bare suffix also matches case numbers: EV 0010 continues case LP/2026/0930-0005.
    fireEvent.change(input, { target: { value: '0005' } })
    await waitFor(() => expect(rowIds().map((id) => id.slice(-4)).sort()).toEqual(['0005', '0010']))

    fireEvent.change(input, { target: { value: 'LP/2026/0930-0003' } })
    // Case 0003 holds EV 0003 and its two follow-ups sealed today (0007, 0009).
    await waitFor(() => expect(rowIds().map((id) => id.slice(-4)).sort()).toEqual(['0003', '0007', '0009']))

    fireEvent.change(input, { target: { value: 'maya lestari' } })
    await waitFor(() => expect(rowIds().map((id) => id.slice(-4))).toEqual(['0004']))

    fireEvent.change(input, { target: { value: 'no such evidence' } })
    expect(await screen.findByTestId('evidence-empty')).toBeInTheDocument()
    expect(tableRows()).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('filters by subject type (the caseType search value), investigator and recorded date', async () => {
    mountEvidence('/evidence?caseType=TERSANGKA')
    await findPage('page-evidence')
    await waitFor(() => expect(tableRows().length).toBeGreaterThan(0))
    for (const row of tableRows()) expect(row.querySelector('[data-subject-type]')?.getAttribute('data-subject-type')).toBe('TERSANGKA')

    cleanup()
    const { sim } = mountEvidence('/evidence?investigator=OPR-002')
    await findPage('page-evidence')
    const byAndi = sim.store.getState().evidence.filter((item) => item.investigatorId === 'OPR-002').length
    await waitFor(() => expect(tableRows()).toHaveLength(Math.min(10, byAndi)))

    cleanup()
    mountEvidence('/evidence?from=2026-09-29&to=2026-09-29')
    await findPage('page-evidence')
    await waitFor(() => expect(rowIds().map((id) => id.slice(-4)).sort()).toEqual(['0001', '0002']))
  })

  it('clamps a stale page number to the last page', async () => {
    mountEvidence('/evidence?page=9')
    await findPage('page-evidence')
    await waitFor(() => expect(tableRows()).toHaveLength(3))
  })

  it('keeps the list live: a new seal appears as a row', async () => {
    const { sim } = mountEvidence('/evidence?status=ARCHIVED')
    await findPage('page-evidence')
    await screen.findByTestId('evidence-empty')
    const target = sim.store.getState().evidence.find((item) => item.status === 'SEALED')
    if (!target) throw new Error('no sealed item')
    // Archiving needs EVIDENCE_REVIEW (Supervisor); drive the store directly for this data check.
    act(() => {
      sim.store.setState((state) => ({
        evidence: state.evidence.map((item) => (item.id === target.id ? { ...item, status: 'ARCHIVED' } : item)),
      }))
    })
    await waitFor(() => expect(rowIds()).toEqual([target.id]))
  })
})

describe('evidence filter helpers', () => {
  const row = { id: 'EV-20260930-0004', item: { caseNumber: 'LP/2026/0930-0004', subjectName: 'Maya Lestari', sessionId: 'SES-20260930-0014' } } as Parameters<typeof matchesSearch>[0]

  it('matches ID, case and subject, case-insensitively', () => {
    expect(matchesSearch(row, '0930-0004')).toBe(true)
    expect(matchesSearch(row, 'ev-20260930')).toBe(true)
    expect(matchesSearch(row, '  MAYA  ')).toBe(true)
    expect(matchesSearch(row, 'hendra')).toBe(false)
    expect(matchesSearch(row, undefined)).toBe(true)
  })

  it('applies an inclusive date range with open ends', () => {
    expect(withinDateRange('2026-09-30', '2026-09-30', '2026-09-30')).toBe(true)
    expect(withinDateRange('2026-09-29', '2026-09-30')).toBe(false)
    expect(withinDateRange('2026-10-01', undefined, '2026-09-30')).toBe(false)
    expect(withinDateRange('2026-10-01')).toBe(true)
  })
})
