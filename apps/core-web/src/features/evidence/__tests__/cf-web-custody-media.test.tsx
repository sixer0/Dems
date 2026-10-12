// Closing fix CF-W: two Low web defects of the re-test round (test/08a_retest_web.md R-W-1,
// test/08c_retest_tablet.md O-RT-1; decisions D209, D210, D212, D214).
//
// | Defect | Root cause | Proven here |
// |--------|------------|-------------|
// | R-W-1 the chain-of-custody table is wider than its card when a row has a multi-word Detail (1440x900: 472 px in 441 px; 1280x800: 97 px over, the Detail hidden) | `integrity-tab.tsx` used the kit's automatic table layout, which never makes a table narrower than the sum of its columns' longest unbreakable words plus 16 px padding a side: the date token (E2E-W1-7, 74 px), `RECORDING_STOPPED` (155 px, no break opportunity), "Pratama", "supervisor" = 472 px | "R-W-1: the custody cells", "R-W-1: the stylesheet" (browser geometry: `gateway_check/12c_cf_web.md`) |
// | O-RT-1 in Live mode the Media tab of an item without a DEMO package says "Its record comes from the simulator" | `media-tab.tsx` always showed `evidence.media.noMediaBody`; plan row W0 item 9 (D158) made the Metadata tab and the preview card follow the mode, not the Media tab | "O-RT-1: Simulated mode keeps its words" here; Live in `src/test/live-cf-web-media.test.tsx` |
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE } from '@dems/shared/api'
import type { DemoCheckId } from '@dems/shared/demo-data'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, type EvidenceItem, type Sim } from '@dems/shared/sim'
import { withProviders } from '@/components/composed/__tests__/test-utils'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { IntegrityTab } from '../integrity-tab'
import { MediaTab } from '../media-tab'
import { buildEvidenceRow, type EvidenceRow } from '../model'
import * as playbackLink from '../playback-link'
import { SessionAnnotations } from '../session-annotations'
import type { EvidenceVerification, VerifyState } from '../use-verification'
import { createDatasetSim, evidenceIdOf, stopSims } from './harness'

const EVIDENCE_CSS = join(dirname(fileURLToPath(import.meta.url)), '../evidence.css')
const SIX: DemoCheckId[] = ['track:VIDEO-01', 'track:VIDEO-02', 'track:AUDIO-01', 'track:AUDIO-02', 'manifest', 'signature']
/** The repro of R-W-1: lane 3, EV-20261006-0014, stopped from the web console with a reason. */
const STOP_REASON = 'R-W re-test: interview ended by the supervisor from the web console'

beforeEach(() => {
  resetMissingI18nKeys()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(() => {
  cleanup()
  stopSims()
  expect(getMissingI18nKeys()).toEqual([])
})

function datasetItem(sim: Sim, suffix: string): EvidenceItem {
  const id = evidenceIdOf(sim, suffix)
  return JSON.parse(JSON.stringify(sim.store.getState().evidence.find((entry) => entry.id === id))) as EvidenceItem
}

const rowOf = (sim: Sim, item: EvidenceItem): EvidenceRow => buildEvidenceRow(item, sim.store.getState().operators)

/** The item as the repro shows it: a stop by the Supervisor with a multi-word reason, then the seal. */
function withStopReason(item: EvidenceItem): EvidenceItem {
  const last = item.custody[item.custody.length - 1]!.at
  return {
    ...item,
    custody: [
      ...item.custody,
      { at: last + 60_000, action: 'RECORDING_STOPPED', actorId: OPERATOR_IDS.ANDI, detail: STOP_REASON },
      { at: last + 61_000, action: 'SEALED', actorId: null, detail: null },
    ],
  }
}

function viewState(): VerifyState {
  return {
    phase: 'idle',
    mode: 'package',
    checks: SIX.map((id) => ({ id, phase: 'pending', expected: null, actual: null, source: null })),
    verdict: null,
    label: null,
    report: null,
    runId: 0,
    bundled: null,
    differs: false,
  }
}

function renderIntegrity(sim: Sim, row: EvidenceRow) {
  const verification: EvidenceVerification = { state: viewState(), run: async () => null }
  return render(withProviders(<IntegrityTab row={row} verification={verification} />, { sim }))
}

/** The body of the rule whose selector is exactly `selector` (whitespace-normalised, comments removed). */
function ruleBody(css: string, selector: string): string | null {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
  const match = new RegExp(`(?:^|[}{;])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(flat)
  return match ? match[1]!.trim() : null
}

/** The inside of the at-rule block whose prelude is exactly `prelude` (braces balanced), or null. */
function atRuleBlock(css: string, prelude: string): string | null {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  const start = flat.indexOf(`${prelude} {`)
  if (start < 0) return null
  let depth = 0
  for (let index = start + prelude.length + 1; index < flat.length; index += 1) {
    if (flat[index] === '{') depth += 1
    else if (flat[index] === '}') {
      depth -= 1
      if (depth === 0) return flat.slice(start + prelude.length + 2, index)
    }
  }
  return null
}

const bodyRows = () => Array.from(screen.getByTestId('evidence-custody').querySelectorAll<HTMLElement>('tbody tr'))

// ── R-W-1 ────────────────────────────────────────────────────────────────────────────────────

describe('R-W-1: the custody cells', () => {
  it('an action code may break only after an underscore: a <wbr> follows each "_" and the words are unchanged', () => {
    const sim = createDatasetSim()
    const item = withStopReason(datasetItem(sim, '0006'))
    renderIntegrity(sim, rowOf(sim, item))
    const rows = bodyRows()
    const newestFirst = [...item.custody].reverse()
    expect(rows).toHaveLength(newestFirst.length)
    expect(newestFirst.some((entry) => entry.action.includes('_'))).toBe(true)
    rows.forEach((row, index) => {
      const action = newestFirst[index]!.action
      const code = row.querySelector('.evi-custody-action')
      // Fix wave J (JW-13): an action the audit vocabulary names is shown by its name (the code is the title); a code it
      // does not hold stays as it is, breakable after an underscore.
      expect(code).toHaveAttribute('title', action)
      const named = Object.prototype.hasOwnProperty.call(en.common.auditType, action)
      if (named) {
        expect(code?.textContent).toBe((en.common.auditType as Record<string, string>)[action])
        expect(code?.querySelectorAll('wbr')).toHaveLength(0)
        return
      }
      expect(code?.textContent).toBe(action)
      const breaks = Array.from(code?.querySelectorAll('wbr') ?? [])
      expect(breaks).toHaveLength(action.split('_').length - 1)
      for (const opportunity of breaks) expect(opportunity.previousSibling?.textContent?.endsWith('_')).toBe(true)
    })
  })

  it('the columns and cells carry the classes the fixed widths and the narrow layout use; an empty Detail is marked', () => {
    const sim = createDatasetSim()
    const item = withStopReason(datasetItem(sim, '0006'))
    renderIntegrity(sim, rowOf(sim, item))
    const headers = within(screen.getByTestId('evidence-custody')).getAllByRole('columnheader')
    expect(headers.map((header) => ['time', 'action', 'actor', 'detail'].find((key) => header.classList.contains(`evi-custody-col-${key}`)))).toEqual([
      'time',
      'action',
      'actor',
      'detail',
    ])
    const newestFirst = [...item.custody].reverse()
    bodyRows().forEach((row, index) => {
      const entry = newestFirst[index]!
      const detail = row.querySelector<HTMLElement>('.evi-custody-detail')
      expect(row.querySelector('.evi-custody-time-cell')).not.toBeNull()
      expect(row.querySelector('.evi-custody-action-cell .evi-custody-action')).not.toBeNull()
      expect(row.querySelector('.evi-custody-actor')).not.toBeNull()
      expect(row.dataset.detail).toBe(entry.detail ? 'true' : 'false')
      if (entry.detail) {
        expect(detail?.textContent).toBe(entry.detail)
        expect(detail?.dataset.empty).toBeUndefined()
      } else {
        expect(detail?.textContent).toBe('—')
        expect(detail?.dataset.empty).toBe('true')
      }
    })
    // The repro row: the reason is in the Detail cell once, whole.
    const stopped = bodyRows().find((row) => row.dataset.custodyAction === 'RECORDING_STOPPED' && row.dataset.detail === 'true')
    expect(stopped?.querySelector('.evi-custody-detail')?.textContent).toBe(STOP_REASON)
    expect(screen.getAllByText(STOP_REASON)).toHaveLength(1)
  })
})

describe('R-W-1: the stylesheet', () => {
  const css = readFileSync(EVIDENCE_CSS, 'utf8')

  it('lays the table out with fixed column widths, so it is never wider than its card', () => {
    expect(ruleBody(css, '.evi-custody-table .table__content')).toBe('table-layout: fixed;')
    expect(ruleBody(css, '.evi-custody-table :is(.table__column, .table__cell)')).toBe('padding-inline: 10px;')
    // The time column holds the date token whole ("6 Oct 2026" = 74 px at 12 px mono, plus 20 px padding).
    expect(ruleBody(css, '.evi-custody-table .evi-custody-col-time')).toBe('width: 6.25rem;')
    expect(ruleBody(css, '.evi-custody-table .evi-custody-col-action')).toBe('width: 30%;')
    expect(ruleBody(css, '.evi-custody-table .evi-custody-col-actor')).toBe('width: 22%;')
  })

  it('wraps the action, the actor and the Detail by words, and breaks a word only when it is longer than its column; never the time', () => {
    const guard = ruleBody(css, '.evi-custody-table :is(.evi-custody-action, .evi-custody-actor, .evi-custody-detail)') ?? ''
    expect(guard).toContain('overflow-wrap: anywhere;')
    expect(guard).toContain('white-space: normal;')
    // E2E-W1-7 holds: the date and the clock never break inside, and hashes keep breaking anywhere.
    expect(ruleBody(css, '.evi-mono.evi-custody-time')).toContain('overflow-wrap: normal;')
    expect(ruleBody(css, '.evi-custody-date, .evi-custody-clock')).toBe('white-space: nowrap;')
    expect(ruleBody(css, '.evi-mono')).toContain('word-break: break-all;')
  })

  it('on a narrow card (< 26rem of content, the 1280 px layout) the Detail goes under the action (three columns), its heading kept for assistive technology', () => {
    expect(ruleBody(css, '.evi-custody-card')).toBe('container: evi-custody / inline-size;')
    // A container query measures the card's content box: 375 px at 1280x800 (narrow), 441 px at 1440x900
    // and 631 px at 1920x1080 (four columns).
    const narrow = atRuleBlock(css, '@container evi-custody (width < 26rem)')
    expect(narrow).not.toBeNull()
    expect(ruleBody(narrow!, '.evi-custody-table tr')).toContain('display: grid;')
    // The fixed widths are table-column widths; inside a grid row they would shrink the headings.
    expect(ruleBody(narrow!, '.evi-custody-table :is(.evi-custody-col-time, .evi-custody-col-action, .evi-custody-col-actor)')).toBe('width: auto;')
    expect(ruleBody(narrow!, '.evi-custody-table tr')).toContain('grid-template-columns: 6.25rem minmax(0, 1fr) minmax(0, 30%);')
    expect(ruleBody(narrow!, '.evi-custody-table .evi-custody-detail')).toContain('grid-column: 2 / -1;')
    expect(ruleBody(narrow!, ".evi-custody-table tr[data-detail='true'] .evi-custody-time-cell")).toContain('grid-row: span 2;')
    // Visually hidden, not display: none — the heading and an empty Detail stay in the accessibility tree.
    const hidden = ruleBody(narrow!, ".evi-custody-table .evi-custody-col-detail, .evi-custody-table .evi-custody-detail[data-empty='true']") ?? ''
    expect(hidden).toContain('clip-path: inset(50%);')
    expect(hidden).toContain('position: absolute;')
    expect(hidden).not.toContain('display: none')
    // The action and the actor of a row with a Detail draw no line above it: the row's line is below the Detail.
    expect(ruleBody(narrow!, ".evi-custody-table tr[data-detail='true'] :is(.evi-custody-action-cell, .evi-custody-actor)")).toBe('border-bottom-color: transparent;')
  })

  it('on a phone-width card (< 20rem of content) the actor and the Detail go under the action (two columns), no code word broken', () => {
    const phone = atRuleBlock(css, '@container evi-custody (width < 20rem)')
    expect(phone).not.toBeNull()
    // After the 26rem block, so its rules win where both apply.
    const flat = css.replace(/\s+/g, ' ')
    expect(flat.indexOf('@container evi-custody (width < 20rem)')).toBeGreaterThan(flat.indexOf('@container evi-custody (width < 26rem)'))
    expect(ruleBody(phone!, '.evi-custody-table tr')).toBe('grid-template-columns: 6.25rem minmax(0, 1fr);')
    expect(ruleBody(phone!, '.evi-custody-table .evi-custody-actor')).toContain('grid-column: 2;')
    expect(ruleBody(phone!, '.evi-custody-table .evi-custody-detail')).toBe('grid-column: 2;')
    // No line between the action and the actor under it (specific enough to beat the kit's cell border).
    expect(ruleBody(phone!, '.evi-custody-table tr.table__row .evi-custody-action-cell')).toContain('border-bottom-color: transparent;')
    expect(ruleBody(phone!, '.evi-custody-table .evi-custody-time-cell')).toBe('grid-row: span 2;')
    expect(ruleBody(phone!, ".evi-custody-table tr[data-detail='true'] .evi-custody-time-cell")).toBe('grid-row: span 3;')
    const actorHeading = ruleBody(phone!, '.evi-custody-table .evi-custody-col-actor') ?? ''
    expect(actorHeading).toContain('clip-path: inset(50%);')
    expect(actorHeading).not.toContain('display: none')
  })
})

// ── O-RT-1 ───────────────────────────────────────────────────────────────────────────────────

describe('O-RT-1: Simulated mode keeps its words', () => {
  it('an item without a DEMO package: "No DEMO media", and its record comes from the simulator', () => {
    const sim = createDatasetSim()
    const row: EvidenceRow = { ...rowOf(sim, datasetItem(sim, '0002')), pkg: null, thumbPath: null, posterPath: null }
    render(withProviders(<MediaTab row={row} playToken={null} onPlayHandled={() => undefined} />, { sim }))
    const empty = screen.getByTestId('evidence-media-empty')
    expect(empty).toHaveAttribute('data-source', 'simulated')
    expect(within(empty).getByText(en.evidence.media.noMedia)).toBeInTheDocument()
    expect(within(empty).getByText(en.evidence.media.noMediaBody)).toBeInTheDocument()
    expect(en.evidence.media.noMediaBody).toMatch(/comes from the simulator/)
    // `mediaUnavailable` is a Live-mode state: in Simulated mode it changes nothing.
    cleanup()
    render(withProviders(<MediaTab row={row} playToken={null} onPlayHandled={() => undefined} mediaUnavailable />, { sim }))
    expect(screen.getByTestId('evidence-media-empty')).toHaveAttribute('data-source', 'simulated')
    expect(screen.getByText(en.evidence.media.noMediaBody)).toBeInTheDocument()
  })
})

// ── JW-13 / JT-11 (fix wave J, rounds one and three) ─────────────────────────────────────────

// What the operator added to the session is ON the item (`contract_wave_j.md` J2-S 1): the markers,
// the notes written during the recording, and - since round two - the note of the session form as
// the first note (`origin: 'SESSION_FORM'`). The block reads the two members BY NAME; the exported
// example `EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE` is the item of these cases.
describe('JW-13: the markers and notes of the session, on the item', () => {
  const annotated = (sim: Sim): EvidenceItem => ({ ...datasetItem(sim, '0002'), ...JSON.parse(JSON.stringify(EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE)) }) as EvidenceItem

  it('the exported example: the marker with its label, the in-session note with its time, and the form\'s note LABELLED as such, without a time', () => {
    const sim = createDatasetSim()
    render(withProviders(<SessionAnnotations item={annotated(sim)} />, { sim }))
    const block = screen.getByTestId('evidence-annotations')
    expect(block).toHaveTextContent('Markers and notes of the session')
    const marker = EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.markers[0]
    expect(within(block).getByTestId('evidence-annotation-markers')).toHaveTextContent(`Marker ${marker.index}: ${marker.label}`)
    const [formNote, sessionNote] = EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.notes
    const form = within(block).getByTestId('evidence-note-form')
    expect(form).toHaveTextContent(`Note from the session form: ${formNote.text}`)
    expect(form).toHaveAttribute('data-origin', 'SESSION_FORM')
    // Its `at` is the creation of the session: no clock time is printed for it.
    expect(form.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/)
    const written = within(block).getAllByTestId('evidence-note')
    expect(written).toHaveLength(1)
    expect(written[0]).toHaveTextContent(`Note: ${sessionNote.text}`)
    expect(written[0]!.textContent).toMatch(/\d{2}:\d{2}:\d{2} UTC/)
    // The form's note is the first of the list, as the Core sends it.
    expect(within(block).getByTestId('evidence-annotation-notes').firstElementChild).toBe(form)
    expect(within(block).queryByTestId('evidence-annotations-none')).toBeNull()
    // No snapshot is offered: an item has no such member.
    expect(block.textContent).not.toMatch(/snapshot/i)
  })

  it('a marker\'s time is pressable: it asks the playback for the marker\'s offset from the start of the recording', () => {
    const sim = createDatasetSim()
    const item = annotated(sim)
    const seek = vi.spyOn(playbackLink, 'requestPlaybackSeek').mockResolvedValue(undefined as never)
    render(withProviders(<SessionAnnotations item={item} />, { sim }))
    const marker = EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.markers[0]
    fireEvent.click(screen.getByTestId(`evidence-marker-${marker.index}`))
    expect(seek).toHaveBeenCalledTimes(1)
    expect(seek).toHaveBeenCalledWith(item.id, Math.max(0, marker.at - item.recordedAt))
    seek.mockRestore()
  })

  it('an item with none says so plainly - "No markers or notes were recorded in this session." - instead of an empty block', () => {
    const sim = createDatasetSim()
    render(withProviders(<SessionAnnotations item={{ ...datasetItem(sim, '0002'), markers: [], notes: [] }} />, { sim }))
    const block = screen.getByTestId('evidence-annotations')
    expect(within(block).getByTestId('evidence-annotations-none')).toHaveTextContent('No markers or notes were recorded in this session.')
    expect(within(block).queryByTestId('evidence-annotation-markers')).toBeNull()
    expect(within(block).queryByTestId('evidence-annotation-notes')).toBeNull()
  })

  it('CONTROL - a note without `origin` is never titled as the form\'s; a record that states neither member draws nothing (the console does not say "none" about what it was not told)', () => {
    const sim = createDatasetSim()
    const base = datasetItem(sim, '0002')
    const [, sessionNote] = EVIDENCE_SESSION_ANNOTATIONS_EXAMPLE.notes
    render(withProviders(<SessionAnnotations item={{ ...base, markers: [], notes: [{ ...sessionNote }] }} />, { sim }))
    expect(screen.queryByTestId('evidence-note-form')).toBeNull()
    expect(screen.getByTestId('evidence-annotations').textContent).not.toContain('Note from the session form')
    cleanup()
    const { markers: _markers, notes: _notes, ...older } = base
    render(withProviders(<SessionAnnotations item={older as EvidenceItem} />, { sim }))
    expect(screen.queryByTestId('evidence-annotations')).toBeNull()
  })
})
