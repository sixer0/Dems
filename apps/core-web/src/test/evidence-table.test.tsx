// AC-64 (masterplan/01_specs.md §14.13, §14.14; blueprint row 47, RL-31): the Evidence table filters
// by status, paginates at 10 per page and searches the evidence ID, case number and subject. The
// fixture is the simulator's own dataset: 13 evidence items (D61), so page 2 exists (≥ 11 rows).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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

// Fix wave Q, driver Q-W (JW-10, NOT CONFIRMED by the confirmation of wave J): on lane 2 one long subject name
// ("Round Two Wijayakusuma Hadiningrat J2M form note Counsel present") made the Subject column 509 px wide and the
// table 1180 px in a 1024 px card at 1280 x 800 (1276 px in 1077 px at 1920 x 1080): the Status column and the row
// menu lay outside the card. The rule, held here (the box check in a browser holds the geometry at the three widths):
// a FIXED table layout as wide as its card; the product's own columns keep a set width; free text wraps inside its
// column and is cut by an ellipsis only with the whole text as its title; the status and the row menu are never cut.
describe('evidence table: every column and the row menu stay inside the card (JW-10)', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../features/evidence/evidence.css'), 'utf8')
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  const rule = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    const match = new RegExp(`(?:^|[}{;])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(flat)
    return match ? match[1]!.trim() : ''
  }

  it('the stylesheet: a fixed layout of the card\'s width; set widths for ID, Duration, Status, Case and the row menu', () => {
    const table = rule('.evi-table .table__content')
    expect(table).toContain('table-layout: fixed;')
    expect(table).toContain('width: 100%;')
    for (const column of ['evidence', 'duration', 'status', 'case']) expect(rule(`.evi-table .evi-col-${column}`), column).toMatch(/^width: \d+(px|%);$/)
    expect(rule('.evi-col-actions')).toContain('width: 52px;')
    expect(rule('.evi-col-select')).toContain('width: 40px;')
    // Subject has NO set width: it takes what is left, whatever the name's length.
    expect(rule('.evi-table .evi-col-subject')).toBe('')
  })

  it('the stylesheet: free text wraps (inside a word too) and is cut after three lines; the status cell and its chip are never cut', () => {
    const free = rule('.evi-table .evi-free')
    expect(free).toContain('white-space: normal;')
    expect(free).toContain('overflow-wrap: anywhere;')
    expect(free).toContain('-webkit-line-clamp: 3;')
    expect(free).toContain('max-width: 100%;')
    const status = rule('.evi-table .evi-cell-status')
    expect(status).toContain('overflow: visible;')
    expect(status).not.toMatch(/ellipsis|line-clamp|hidden/)
    expect(rule('.evi-status-chip, .evi-subject-chip')).toBe('white-space: nowrap;')
    expect(rule('.evi-col-actions')).not.toMatch(/ellipsis|hidden/)
  })

  it('a row with a very long subject and case: both carry the whole text as their title and the free-text class; the status chip and the row menu do not', async () => {
    const { sim } = mountEvidence('/evidence')
    await findPage('page-evidence')
    await waitFor(() => expect(tableRows()).toHaveLength(10))
    const target = sim.store.getState().evidence.find((item) => item.id === rowIds()[0])!
    const subjectName = 'Round Two Wijayakusuma Hadiningrat J2M form note Counsel present and a name without any space Wijayakusumahadiningratsastrowardoyo'
    const caseNumber = 'LP/B/2026/X/SPKT/POLDA-METRO-JAYA/DITRESKRIMUM/1012-9907'
    act(() => {
      sim.store.setState({ evidence: sim.store.getState().evidence.map((item) => (item.id === target.id ? { ...item, subjectName, caseNumber } : item)) })
    })
    const subject = await screen.findByTestId(`evidence-row-subject-${target.id}`)
    await waitFor(() => expect(subject).toHaveTextContent(subjectName))
    expect(subject).toHaveAttribute('title', subjectName)
    expect(subject).toHaveClass('evi-free')
    const caseCell = screen.getByTestId(`evidence-row-case-${target.id}`)
    expect(caseCell).toHaveTextContent(caseNumber)
    expect(caseCell).toHaveAttribute('title', caseNumber)
    expect(caseCell).toHaveClass('evi-free')
    // The whole name is the row's text for assistive technology (nothing of it is removed from the document).
    const row = tableRows().find((entry) => entry.dataset.rowId === target.id)!
    expect(row.textContent).toContain(subjectName)
    // CP-05 control: Simulated mode draws no "Demonstration record" mark on a row (the Live case: `live-w0-evidence-words.test.tsx`).
    expect(document.querySelector('[data-demonstration]')).toBeNull()
    // Status and Actions: in their own cells, with no free-text class on them or inside them.
    const status = row.querySelector<HTMLElement>('.evi-cell-status')!
    expect(status.querySelector('[data-evidence-status]')).not.toBeNull()
    expect(status.querySelector('.evi-free')).toBeNull()
    const menu = within(row).getByTestId(`evidence-row-menu-${target.id}`)
    expect(menu.closest('td')).toHaveClass('evi-col-actions')
    expect(menu.closest('.evi-free')).toBeNull()
    // The header carries the column classes the fixed layout reads its widths from.
    const headers = within(screen.getByTestId('evidence-table')).getAllByRole('columnheader')
    expect(headers.map((header) => [...header.classList].find((name) => name.startsWith('evi-col-')))).toEqual([
      'evi-col-select',
      'evi-col-thumb',
      'evi-col-evidence',
      'evi-col-subject',
      'evi-col-case',
      'evi-col-duration',
      'evi-col-status',
      'evi-col-actions',
    ])
    expect(getMissingI18nKeys()).toEqual([])
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
