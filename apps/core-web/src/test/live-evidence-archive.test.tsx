/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W69: settle site B-1 of the Evidence page — archive, from the detail header and from the
// list's row menu — in Live mode on the contract-checked fake transport, and the static rules of the
// folder (backend task 04_client_integration_spec §8.3 B-1, §8.1 LB-1 to LB-10, §6.2; gate CLG (b),
// (c) of 02_plan §11; AC-C-48, AC-C-53, AC-C-57, AC-C-58).
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | B-1 success: one POST to operation 43; the status chip morphs with the delta; the toast after the answer | "B-1 success" |
// | B-1 refusal, AC-C-48: a 403 NOT_PERMITTED (the contract's `notPermitted` example) shows the denied toast naming the Supervisor role; the control returns to idle | "B-1 refusal" |
// | B-1: 409 NOT_SEALED keeps the existing not-sealed warning | "B-1 refusal" |
// | B-1 outage, LB-6; LB-10 | "B-1 outage" |
// | LB-1, AC-C-57/58: busy at once on the nearest container (F63-2), spinner late, no second archive | "B-1 pending" |
// | CLG (c), AC-C-53: no `useSimActions`, no `.actions` read on a `Sim`; the three actions run inside `settle`; the presenter speaks first; MD-6, TS-15 | "static rules of the folder" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { act, cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { rateLimited, type FakeCommandOptions } from '@dems/shared/live/testing'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import type { LiveTestBed } from '@/runtime/testing/live-harness'
import {
  clearToasts,
  EV,
  evidenceWith,
  findDetailBody,
  installJsdomStubs,
  openLiveEvidence,
  toastTexts,
  toastWith,
  type LiveEvidence,
} from '@/features/evidence/__tests__/live-evidence-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 40_000 })

const A = en.evidence.archive
const DENIED = en.common.rbac.deniedTitle
const REQUIRES = (role: string) => en.common.rbac.requiresRole.replace('{{role}}', role)
const OFFLINE = en.common.coreErrors.offline
const UI = { timeout: 15_000 }

let opened: LiveEvidence | undefined

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  installJsdomStubs()
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  opened?.bed.dispose()
  opened = undefined
  vi.restoreAllMocks()
})

const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)
/** The delta of an archive on the Core: the item ARCHIVED with its custody entry. */
const archivedOps = (bed: LiveTestBed, evidenceId: string): FakeCommandOptions['ops'] => {
  const at = bed.fake.clock.now()
  const value = evidenceWith(bed, evidenceId, (item) => ({
    ...item,
    status: 'ARCHIVED',
    lifecycleStage: 'RETENTION_ARCHIVE_DISPOSITION',
    custody: [...item.custody, { at, action: 'ARCHIVED', actorId: 'OPR-002', detail: null }],
  }))
  return [{ op: 'replace', slice: 'evidence', value }] as FakeCommandOptions['ops']
}

async function openDetail(evidenceId: string): Promise<LiveEvidence> {
  opened = await openLiveEvidence(`/evidence/${evidenceId}`)
  await findDetailBody()
  return opened
}

/** Opens the header's "More" menu and returns it. */
async function openMore(): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('evidence-more'))
  return screen.findByRole('menu')
}
async function pressArchive(): Promise<void> {
  const menu = await openMore()
  fireEvent.click(within(menu).getByRole('menuitem', { name: /^Archive/ }))
}
const headerStatus = () => screen.getByTestId('evidence-detail-header').querySelector('[data-evidence-status]')
const actionRow = () => screen.getByTestId('evidence-more').closest('.evi-detail-actions') as HTMLElement

describe('B-1 success (§8.3; LB-3)', () => {
  it('detail header: one POST to operation 43; the menu closes at the press; the status chip shows ARCHIVED before the toast', async () => {
    const { bed } = await openDetail(EV.sealed)
    expect(headerStatus()).toHaveAttribute('data-evidence-status', 'SEALED')
    const command = bed.fake.scriptCommand('archiveEvidence', { ops: archivedOps(bed, EV.sealed), order: 'delta-first' })
    await pressArchive()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await waitFor(() => expect(toastWith(A.success.replace('{{id}}', EV.sealed))).toHaveLength(1))
    expect(command.deltaSent).toBe(true)
    expect(headerStatus()).toHaveAttribute('data-evidence-status', 'ARCHIVED')
    expect(requests('archiveEvidence')).toHaveLength(1)
    expect(requests('archiveEvidence')[0]).toMatchObject({ method: 'POST', path: `/api/v1/evidence/${EV.sealed}/archive`, params: { id: EV.sealed } })
    expect(actionRow()).not.toHaveAttribute('aria-busy')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('list row menu: one POST to operation 43 for that row and the toast after the answer', async () => {
    opened = await openLiveEvidence('/evidence')
    await screen.findByTestId('evidence-list-body', {}, UI)
    const { bed } = opened
    bed.fake.scriptCommand('archiveEvidence', { ops: archivedOps(bed, 'EV-20261001-0012'), order: 'delta-first' })
    fireEvent.click(await screen.findByTestId('evidence-row-menu-EV-20261001-0012', {}, UI))
    const menu = await screen.findByRole('menu')
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Archive/ }))
    await waitFor(() => expect(toastWith(A.success.replace('{{id}}', 'EV-20261001-0012'))).toHaveLength(1))
    expect(requests('archiveEvidence').map((call) => call.params.id)).toEqual(['EV-20261001-0012'])
    expect(screen.getByTestId('evidence-table')).not.toHaveAttribute('aria-busy')
  })
})

describe('B-1 refusal (§6.2; AC-C-48; LB-5)', () => {
  it('a 403 NOT_PERMITTED shows the denied toast naming the Supervisor role; no success toast, no page record; the control is idle again', async () => {
    const { bed } = await openDetail(EV.sealed)
    bed.fake.answerOnce('archiveEvidence', bed.fake.example('archiveEvidence', 403, 'notPermitted'))
    await pressArchive()
    await waitFor(() => expect(toastWith(DENIED)).toHaveLength(1))
    expect(toastWith(DENIED)[0]).toContain(REQUIRES(en.common.roles.SUPERVISOR))
    expect(toastWith(A.success.replace('{{id}}', EV.sealed))).toHaveLength(0)
    expect(toastWith(A.failed)).toHaveLength(0)
    expect(webErrorSink.records().filter((record) => record.source.startsWith('Evidence.'))).toHaveLength(0)
    expect(actionRow()).not.toHaveAttribute('aria-busy')
    const menu = await openMore()
    expect(within(menu).getByRole('menuitem', { name: /^Archive/ })).not.toHaveAttribute('aria-disabled', 'true')
    expect(headerStatus()).toHaveAttribute('data-evidence-status', 'SEALED')
  })

  it('409 NOT_SEALED (rebuilt as `SimTransitionError`) keeps the existing not-sealed warning', async () => {
    const { bed } = await openDetail(EV.sealed)
    bed.fake.answerOnce('archiveEvidence', bed.fake.example('archiveEvidence', 409, 'notSealed'))
    await pressArchive()
    await waitFor(() => expect(toastWith(A.notSealed)).toHaveLength(1))
    expect(toastWith(DENIED)).toHaveLength(0)
    expect(toastWith(OFFLINE)).toHaveLength(0)
  })
})

describe('B-1 outage (LB-6, LB-10)', () => {
  it('a request without an answer shows "Core server unreachable. Nothing was changed.", no success toast, and the control returns to idle', async () => {
    const { bed } = await openDetail(EV.sealed)
    bed.fake.failOnce('archiveEvidence')
    await pressArchive()
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(toastTexts()).toHaveLength(1)
    expect(actionRow()).not.toHaveAttribute('aria-busy')
    expect(requests('archiveEvidence')).toHaveLength(1)
  })

  it('LB-10: a 429 shows the limit toast, never the outage sentence', async () => {
    const { bed } = await openDetail(EV.sealed)
    bed.fake.answerOnce('archiveEvidence', rateLimited(5))
    await pressArchive()
    await waitFor(() => expect(toastWith(en.common.coreErrors.limited.replace('{{seconds}}', '5'))).toHaveLength(1))
    expect(toastWith(OFFLINE)).toHaveLength(0)
  })
})

describe('B-1 pending (LB-1: busy at once, spinner late; AC-C-57, AC-C-58)', () => {
  it('while the archive is out the action row is `aria-busy`, no second archive can be sent, and the spinner replaces the icon only after the reveal time', async () => {
    const { bed } = await openDetail(EV.sealed)
    const held = bed.fake.hold('archiveEvidence')
    await pressArchive()
    await waitFor(() => expect(requests('archiveEvidence')).toHaveLength(1))
    await bed.flush()
    // Busy at once on the nearest container (the kit's Button drops `aria-busy`, F63-2); the look is unchanged.
    expect(actionRow()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('evidence-more')).not.toHaveAttribute('data-pending')
    const menu = await openMore()
    expect(within(menu).getByRole('menuitem', { name: /^Archive/ })).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Archive/ }))
    fireEvent.keyDown(menu, { key: 'Escape' })
    await bed.flush()
    expect(requests('archiveEvidence')).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('evidence-more')).toHaveAttribute('data-pending', 'true'), { timeout: 3_000 })
    await act(async () => {
      held.release()
    })
    await bed.flush()
    await waitFor(() => expect(toastWith(A.success.replace('{{id}}', EV.sealed))).toHaveLength(1))
    expect(actionRow()).not.toHaveAttribute('aria-busy')
    expect(screen.getByTestId('evidence-more')).not.toHaveAttribute('data-pending')
  })
})

// ── CLG (c): the folder's production files ──────────────────────────────────────────────────

describe('static rules of the folder (AC-C-53, MD-6, TS-15; rules 1 and 2 of the page rows)', () => {
  const folder = join((import.meta as { dirname?: string }).dirname ?? '.', '..', 'features', 'evidence')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
      return /\.(ts|tsx)$/.test(name) ? [path] : []
    })
  const production = walk(folder).map((path) => ({ name: relative(folder, path), text: readFileSync(path, 'utf8') }))
  /** The code of a file without its comments: a rule is about what runs. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  const fileCode = (name: string) => code(production.find((file) => file.name === name)?.text ?? '')

  it('reads the files it means to read', () => {
    expect(production.map((file) => file.name)).toEqual(
      expect.arrayContaining(['export-wizard.tsx', 'use-verification.ts', 'use-archive.ts', 'sim-adapter.ts', 'detail-page.tsx', 'list-page.tsx', 'use-evidence-media.ts']),
    )
    expect(production.length).toBeGreaterThanOrEqual(30)
  })

  it('AC-C-53: no file imports `useSimActions` or reads `.actions` of a `Sim`, `SimContext` or `live.source`', () => {
    // Quoted i18n keys (`'common.actions.retry'`, `'evidence.detail.actions.play'`, `'evidence.table.columns.actions'`) are words, not a read of a data source: they are left out.
    const withoutActionWords = (text: string) => code(text).replace(/(['"`])[\w.]*\.actions(\.[\w.]+)?\1/g, "''").replace(/common\.actions\.[A-Za-z]+/g, '')
    for (const { name, text } of production) {
      expect(text, name).not.toMatch(/useSimActions/)
      expect(withoutActionWords(text), name).not.toMatch(/\.actions\b/)
      expect(code(text), name).not.toMatch(/\bSimContext\b|live\.source/)
    }
  })

  it('rule 1: the three actions come from `useCoreActions()` and each call runs inside `settle`', () => {
    const calls = production.flatMap(({ name, text }) => (code(text).match(/actions\.(verify|exportEvidence|archiveEvidence|inject)\(/g) ?? []).map((call) => `${name}: ${call}`))
    expect(calls.sort()).toEqual([
      'export-wizard.tsx: actions.exportEvidence(',
      'sim-adapter.ts: actions.inject(',
      'sim-adapter.ts: actions.verify(',
      'use-archive.ts: actions.archiveEvidence(',
      'use-verification.ts: actions.verify(',
    ])
    expect(fileCode('export-wizard.tsx')).toMatch(/settle\(\(\) => actions\.exportEvidence\(/)
    expect(fileCode('use-archive.ts')).toMatch(/settle\(\(\) => actions\.archiveEvidence\(/)
    expect(fileCode('use-verification.ts')).toMatch(/settle\(\(\) => actions\.verify\(/)
    expect(fileCode('sim-adapter.ts')).toMatch(/settle\(\(\) => actions\.verify\(/)
    expect(fileCode('sim-adapter.ts')).toMatch(/settle\(\(\) => actions\.inject\(/)
    for (const name of ['export-wizard.tsx', 'use-archive.ts', 'use-verification.ts']) expect(fileCode(name), name).toMatch(/useCoreActions\(\)/)
    // D-1: the tamper mirror is reached only from the Simulated branch of the verification.
    const verification = fileCode('use-verification.ts')
    expect(verification.indexOf('recordPackageVerification(actions')).toBeGreaterThan(verification.indexOf('} else if (target.pkg) {'))
    // The one call of an operation that is no action: operation 40, through `useWebLive()`.
    const clientCalls = production.flatMap(({ name, text }) => (code(text).match(/client\.call\('[A-Za-z]+'/g) ?? []).map((call) => `${name}: ${call}`))
    // Row 92 (M8-W3) adds the reads and commands of the sealed item that are no simulator action: the export
    // job (87), the media session (88: once with the file, once without for a registry that has no body yet)
    // and the transcript (84, 86, 85). Each goes through `useWebLive()`'s client, as operation 40 does.
    expect(clientCalls).toEqual([
      "export-job.ts: client.call('getEvidenceExportJob'",
      // Fix pass F-M8 (R93-05): the ONE fresh read at the press of "Download export" (its signed path is never cached).
      "export-job.ts: client.call('getEvidenceExportJob'",
      "media-session.ts: client.call('createEvidenceMediaSession'",
      "media-session.ts: client.call('createEvidenceMediaSession'",
      "transcript.ts: client.call('getTranscript'",
      "transcript.ts: client.call('listTranscriptRevisions'",
      "transcript.ts: client.call('createTranscriptRevision'",
      "use-evidence-media.ts: client.call('getEvidence'",
    ])
  })

  it('rule 2: every refusal goes to the presenter before the page\'s own words', () => {
    expect(fileCode('use-archive.ts')).toMatch(/if \(presentCoreError\(error\) !== null\) return/)
    expect(fileCode('use-verification.ts')).toMatch(/if \(presentCoreError\(error\) === null\) throw error/)
    expect(fileCode('export-wizard.tsx')).toMatch(/const notice = presentCoreError\(error\)/)
    expect(fileCode('use-evidence-media.ts')).toMatch(/presentCoreError\(answer, \{ permission: Permission\.EVIDENCE_VIEW \}\) === null/)
    // No page sentence of its own for an outage or a limit (the page reuses the presenter's words).
    // (`backendUnreachable` is a member of the contract's transcript summary, not a sentence of the page: row 92.)
    for (const { name, text } of production) expect(code(text).replaceAll('backendUnreachable', ''), name).not.toMatch(/unreachable|limiting requests/i)
  })

  it('MD-6, TS-15: no file loads the typed client or the Live source, builds a client, opens a socket or imports a test double', () => {
    for (const { name, text } of production) {
      const source = code(text)
      expect(source, name).not.toMatch(/from '@dems\/shared\/(client|live\/source|live\/testing)'/)
      expect(source, name).not.toMatch(/createCoreClient|createLiveSim|runtime\/(testing|live-start|boot)|new WebSocket/)
    }
  })

  it('error logging: no failure is written to the console directly; the page\'s record goes to the sink by a fixed sentence', () => {
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/console\.(error|warn|log|info)/)
    const log = fileCode('log.ts')
    expect(log).toMatch(/webErrorSink/)
    // CPW1-8: never the text of the error as the message.
    expect(log).not.toMatch(/message:\s*error|error\.message/)
  })
})
