/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W75: the Security & Audit page in Live mode beyond its three settle sites — the role and
// permission matrix from operation 10 (twelve rows in Live mode, the nine-row list in Simulated
// mode), the actor of a failed sign-in, the StrictMode start, and the static rules of the folder
// (backend task 04_client_integration_spec §6.1, finding FC-3, TS-8; §7.3 G10; security review
// CPS1-12 (a); gateway_check/08_cp_web_runtime.md §8 rules 1 to 9; 08a §15; gate CLG (c) of
// 02_plan §11). The page of this file is `http://127.0.0.1:5178/`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | FC-3 / TS-8: Live mode renders the Core's twelve rows from operation 10, in the Core's order with its grants; Simulated mode keeps nine | "the role matrix" |
// | Cache contract (rule 3): the matrix is one query under `CORE_QUERY_KEYS.roleMatrix`; under StrictMode ONE request (08a §15) | "the role matrix", "StrictMode" |
// | An unanswered or refused matrix: the presenter's toast, an inline message and a rate-limited Retry (3 s → 6 s → 12 s) | "the role matrix" |
// | CPS1-12 (a): a failed sign-in or a lockout names the operator whose username was TYPED — worded so in Live mode; Simulated keeps its words | "the actor of a failed sign-in" |
// | CLG (c), AC-C-53, rules 1, 2, 3, 4, 9, TS-15, MD-6, CPW1-8, 08a §15 | "static rules of the folder" |
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_API_EXAMPLES, type RoleMatrix } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { OPERATOR_IDS, OPERATORS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { CORE_QUERY_KEYS, webErrorSink } from '@/runtime'
import type { LivePage, LiveTestBed } from '@/runtime/testing/live-harness'
import {
  clearToasts,
  liveSecurityAudit,
  makeSim,
  simulatedSecurityAudit,
  stubViewport,
  toastWith,
} from '@/features/security-audit/__tests__/live-security-audit-bed'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const R = en.securityAudit.rbac
const LR = en.securityAudit.live.rbac
const OFFLINE = en.common.coreErrors.offline
const ORIGIN_REFUSED = en.common.coreErrors.originNotAllowed.split('{{')[0]!
const RETRY_IN = (seconds: number) => en.common.actions.retryIn.replace('{{seconds}}', String(seconds))
const TYPED = (name: string) => en.securityAudit.live.audit.typedActor.replace('{{name}}', name)
const SEEDED = (CORE_API_EXAMPLES.getRoleMatrix!.responses[200] as Record<string, { value: RoleMatrix }>).seeded!.value
const BUDI = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.BUDI)!

let bed: LiveTestBed | undefined
let loaded: LivePage | undefined
let restoreViewport: () => void = () => undefined
const sims: Sim[] = []

const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)

async function live(options: Parameters<typeof liveSecurityAudit>[0] = {}) {
  const created = await liveSecurityAudit(options)
  bed = created.bed
  loaded = created.page
  return created
}

/** The text of the first cell of each body row of the matrix. */
const matrixLabels = (table: HTMLElement): string[] =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('rowheader')[0]?.textContent ?? '')
const grantsOf = (table: HTMLElement, label: string): (string | null)[] => {
  const row = within(table).getAllByRole('row').find((candidate) => candidate.textContent?.includes(label))
  return Array.from(row?.querySelectorAll('[data-granted]') ?? []).map((cell) => cell.getAttribute('data-granted'))
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

describe('the role matrix (§6.1; FC-3; TS-8)', () => {
  it('Live: the Core\'s twelve permissions from operation 10, in its order, with its grants; one request; the cache entry is the runtime\'s key', async () => {
    const { mounted } = await live()
    const table = await screen.findByTestId('rbac-matrix')
    expect(table).toHaveAttribute('data-matrix-source', 'core')
    expect(within(table).getAllByRole('row')).toHaveLength(13)
    expect(matrixLabels(table)).toEqual(SEEDED.permissions.map((permission) => R.permissions[permission]))
    // The grants are the Core's: 18 checks in the seeded matrix; USER_ADMIN only for the Supervisor.
    expect(table.querySelectorAll('[data-granted="true"]')).toHaveLength(SEEDED.grants.length)
    expect(grantsOf(table, R.permissions.USER_ADMIN)).toEqual(['false', 'true', 'false'])
    expect(requests('getRoleMatrix')).toHaveLength(1)
    expect(requests('getRoleMatrix')[0]).toMatchObject({ method: 'GET', path: '/api/v1/rbac/matrix' })
    expect(mounted.queryClient.getQueryData(CORE_QUERY_KEYS.roleMatrix)).toMatchObject({ permissions: SEEDED.permissions })
    expect(screen.getByTestId('panel-rbac')).toHaveTextContent(LR.subtitle)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Live: the matrix is shown as the Core grants it, not as the console\'s static table', async () => {
    await live({
      matrix: false,
      prepare: (created) =>
        created.fake.answer('getRoleMatrix', {
          status: 200,
          body: { ...SEEDED, grants: [...SEEDED.grants, { role: 'INVESTIGATOR', permission: 'AUDIT_EXPORT' }] },
        }),
    })
    const table = await screen.findByTestId('rbac-matrix')
    expect(grantsOf(table, R.permissions.AUDIT_EXPORT)).toEqual(['true', 'true', 'false'])
  })

  it('Live, no answer: the presenter\'s sentence once, the inline message and Retry; Retry reads again and cools down; the third read shows the matrix', async () => {
    await live({
      matrix: false,
      prepare: (created) => {
        created.fake.failOnce('getRoleMatrix')
        created.fake.failOnce('getRoleMatrix')
        created.fake.answer('getRoleMatrix', created.fake.example('getRoleMatrix', 200, 'seeded'))
      },
    })
    const failed = await screen.findByTestId('rbac-matrix-failed')
    expect(failed).toHaveTextContent(LR.failed)
    await waitFor(() => expect(toastWith(OFFLINE)).toHaveLength(1))
    expect(requests('getRoleMatrix')).toHaveLength(1)
    // An outage is the presenter's: the page writes no record of its own.
    expect(webErrorSink.records().filter((record) => record.source === 'SecurityAudit.RbacPanel.roleMatrix')).toHaveLength(0)

    fireEvent.click(within(failed).getByTestId('rbac-matrix-retry'))
    await waitFor(() => expect(requests('getRoleMatrix')).toHaveLength(2))
    await waitFor(() => expect(screen.getByTestId('rbac-matrix-retry')).toHaveTextContent(RETRY_IN(3)))
    expect(screen.getByTestId('rbac-matrix-retry')).toBeDisabled()
    // A press during the cooldown reads nothing.
    fireEvent.click(screen.getByTestId('rbac-matrix-retry'))
    expect(requests('getRoleMatrix')).toHaveLength(2)
    await waitFor(() => expect(screen.getByTestId('rbac-matrix-retry')).not.toBeDisabled(), { timeout: 6_000 })
    fireEvent.click(screen.getByTestId('rbac-matrix-retry'))
    const table = await screen.findByTestId('rbac-matrix')
    expect(within(table).getAllByRole('row')).toHaveLength(13)
    expect(requests('getRoleMatrix')).toHaveLength(3)
  })

  it('Live, refused: the documented 403 (ORIGIN_NOT_ALLOWED; operation 10 needs only a signed-in operator) is worded by the presenter; the inline message stays', async () => {
    await live({
      matrix: false,
      prepare: (created) => created.fake.answerOnce('getRoleMatrix', created.fake.example('getRoleMatrix', 403, 'originNotAllowed')),
    })
    await screen.findByTestId('rbac-matrix-failed')
    await waitFor(() => expect(toastWith(ORIGIN_REFUSED)).toHaveLength(1))
    expect(screen.queryByTestId('rbac-matrix')).not.toBeInTheDocument()
  })

  it('Live: after the session ends, the matrix is not read again (no request the Core can only refuse with 401)', async () => {
    const { bed } = await live()
    await screen.findByTestId('rbac-matrix')
    expect(requests('getRoleMatrix')).toHaveLength(1)
    bed.core.end('SIGNED_OUT')
    await bed.flush()
    await bed.elapse(1_000)
    await waitFor(() => expect(screen.queryByTestId('page-security-audit')).not.toBeInTheDocument(), { timeout: 8_000 })
    expect(requests('getRoleMatrix')).toHaveLength(1)
  })

  it('Simulated: the nine-row list of the simulator, its own words, no request (TS-8)', async () => {
    const fetchSpy = vi.fn(async (_input: unknown) => new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchSpy)
    const sim = makeSim(OPERATOR_IDS.BUDI)
    sims.push(sim)
    await simulatedSecurityAudit(sim)
    const table = await screen.findByTestId('rbac-matrix')
    expect(within(table).getAllByRole('row')).toHaveLength(10)
    expect(table).not.toHaveAttribute('data-matrix-source')
    expect(table).not.toHaveTextContent(R.permissions.USER_ADMIN)
    expect(screen.getByTestId('panel-rbac')).toHaveTextContent(R.subtitle)
    expect(fetchSpy.mock.calls.map((call) => String(call[0])).filter((url) => url.includes('/rbac/'))).toEqual([])
  })
})

describe('StrictMode (F69-1; 08a §15)', () => {
  it('the page under StrictMode reads the matrix ONCE; Verify sends one request per press', async () => {
    const { bed } = await live({ strict: true })
    await screen.findByTestId('rbac-matrix')
    await bed.flush()
    expect(requests('getRoleMatrix')).toHaveLength(1)
    // No other Core call is started by mounting the page.
    expect(requests('verifyAuditChain')).toHaveLength(0)
    expect(requests('listAuditRows')).toHaveLength(0)
    expect(requests('exportAudit')).toHaveLength(0)
    expect(requests('acknowledgeAlert')).toHaveLength(0)
    bed.fake.answerOnce('verifyAuditChain', bed.fake.example('verifyAuditChain', 200, 'intact'))
    fireEvent.click(screen.getByTestId('verify-chain'))
    await waitFor(() => expect(screen.getByTestId('chain-verified')).toHaveAttribute('data-verified', 'PASS'))
    expect(requests('verifyAuditChain')).toHaveLength(1)
  })
})

describe('the actor of a failed sign-in (CPS1-12 (a))', () => {
  /** The Core's history with two failed sign-ins typed with the INVESTIGATOR's username. */
  const failedSignIns = (): Sim => {
    const sim = makeSim(OPERATOR_IDS.ANDI, (created) => {
      created.actions.signIn(BUDI.username, 'not-the-password-1')
      created.actions.signIn(BUDI.username, 'not-the-password-2')
    })
    sims.push(sim)
    return sim
  }

  it('Live: the authentication feed and the audit table name the operator whose username was typed, as unverified', async () => {
    const core = failedSignIns()
    const failedRows = core.store.getState().audit.rows.filter((row) => row.type === 'AUTH_FAILED')
    expect(failedRows.length).toBeGreaterThanOrEqual(2)
    expect(failedRows.every((row) => row.actorId === OPERATOR_IDS.BUDI)).toBe(true)
    await live({ served: () => core.store.getState() })
    const feed = await screen.findByTestId('auth-feed')
    await waitFor(() => expect(within(feed).getAllByText(TYPED(BUDI.displayName), { exact: false }).length).toBeGreaterThanOrEqual(2))
    const table = screen.getByTestId('audit-table')
    const newest = failedRows.at(-1)!
    const row = await waitFor(() => {
      const found = table.querySelector(`[data-seq="${newest.seq}"]`)
      expect(found).not.toBeNull()
      return found as HTMLElement
    })
    expect(row).toHaveTextContent(TYPED(BUDI.displayName))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('Simulated: the same history keeps the operator\'s name as before', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    const sim = failedSignIns()
    await simulatedSecurityAudit(sim)
    const feed = await screen.findByTestId('auth-feed')
    await waitFor(() => expect(within(feed).getAllByText(BUDI.displayName, { exact: false }).length).toBeGreaterThan(0))
    expect(feed).not.toHaveTextContent('username typed')
    expect(screen.getByTestId('audit-table')).not.toHaveTextContent('username typed')
  })
})

// ── Static rules of the folder's production files ────────────────────────────────────────────

describe('static rules of the folder (CLG (c); rules 1 to 4 and 9 of 08 §8; 08a §15)', () => {
  const folder = resolve(import.meta.dirname, '../features/security-audit')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : walk(path)
      return /\.tsx?$/.test(name) ? [path] : []
    })
  const production = walk(folder).map((path) => ({ name: relative(folder, path), text: readFileSync(path, 'utf8') }))
  /** The code of a file without its comments: a rule is about what runs. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  const file = (name: string) => code(production.find((entry) => entry.name === name)?.text ?? '')

  it('reads the files it means to read', () => {
    expect(production.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['chain-panel.tsx', 'chain-core-lines.tsx', 'export-audit-dialog.tsx', 'export-file.ts', 'rbac-panel.tsx', 'sim-adapter.ts', 'log.ts']),
    )
    expect(production.length).toBeGreaterThanOrEqual(24)
  })

  it('AC-C-53: no file imports `useSimActions` or reads `.actions` of a `Sim`; no `SimContext`, no `live.source`', () => {
    const withoutActionWords = (text: string) => code(text).replace(/common\.actions\.[A-Za-z]+/g, '')
    for (const { name, text } of production) {
      expect(text, name).not.toMatch(/useSimActions/)
      expect(withoutActionWords(text), name).not.toMatch(/\.actions\b/)
      expect(code(text), name).not.toMatch(/\bSimContext\b|live\.source/)
    }
  })

  it('rule 1: every action runs inside `settle`; the actions come from `useCoreActions()` (the synchronous Simulated form uses `coreActionsOf`)', () => {
    const chain = file('chain-panel.tsx')
    expect(chain).toMatch(/useCoreActions\(\)/)
    expect(chain.match(/actions\.verifyAuditChain\(/g)).toHaveLength(1)
    expect(chain.match(/settle\(\(\) => actions\.verifyAuditChain\(\)/g)).toHaveLength(1)
    expect(chain.match(/actions\.acknowledgeAlert\(/g)).toHaveLength(1)
    expect(chain.match(/settle\(\(\) => actions\.acknowledgeAlert\(/g)).toHaveLength(1)
    const dialog = file('export-audit-dialog.tsx')
    expect(dialog).toMatch(/useCoreActions\(\)/)
    expect(dialog.match(/actions\.exportAudit\(/g)).toHaveLength(1)
    expect(dialog.match(/settle\(\(\) => actions\.exportAudit\(/g)).toHaveLength(1)
    // The one other way to the action: the folder's synchronous adapter over a simulator.
    expect(file('sim-adapter.ts')).toMatch(/coreActionsOf\(sim\)\.exportAudit\(/)
    for (const { name, text } of production) {
      if (name === 'chain-panel.tsx' || name === 'export-audit-dialog.tsx' || name === 'sim-adapter.ts') continue
      expect(code(text), name).not.toMatch(/actions\.[a-zA-Z]+\(/)
    }
  })

  it('rule 1: the only operations called through the typed client are 59 `listAuditRows` and 10 `getRoleMatrix`', () => {
    const calls = production.flatMap(({ text }) => Array.from(code(text).matchAll(/client\.call\('([A-Za-z]+)'/g), (match) => match[1]))
    expect(calls.sort()).toEqual(['getRoleMatrix', 'listAuditRows'])
  })

  it('rule 2: the presenter speaks first in every branch that words a failure', () => {
    const chain = file('chain-panel.tsx')
    expect(chain.match(/if \(presentCoreError\(error\) !== null\) return/g)).toHaveLength(2)
    expect(chain.indexOf('if (presentCoreError(error) !== null) return')).toBeLessThan(chain.indexOf("logSecurityAudit('error', 'ChainPanel.verify'"))
    const dialog = file('export-audit-dialog.tsx')
    expect(dialog).toMatch(/if \(presentCoreError\(caught\) !== null\) return/)
    expect(dialog).toMatch(/presentCoreError\(caught\.reason\.failure\)/)
    expect(file('rbac-panel.tsx')).toMatch(/if \(presentCoreError\(answer\) === null\) logSecurityAudit/)
    // A page never writes its own outage or limit sentence (LB-6, LB-10).
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/unreachable|limiting requests/i)
  })

  it('rule 3: the Core list lives under the runtime\'s key; no key of the page starts with \'core\'', () => {
    expect(file('rbac-panel.tsx')).toMatch(/queryKey: CORE_QUERY_KEYS\.roleMatrix/)
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/\[\s*'core'/)
  })

  it('08a §15: one pending control from `@/lib/pending-control`, never a guard or reveal timer of the page; no effect starts a Core call', () => {
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/LIVE_PENDING_REVEAL_MS|usePendingReveal/)
    expect(file('chain-panel.tsx')).toMatch(/usePendingControl\(\)/)
    expect(file('export-audit-dialog.tsx')).toMatch(/usePendingControl\(\)/)
    // The busy mark: the hook's `ref` on the pressed kit Button (destructured from the one hook).
    expect(file('chain-panel.tsx')).toMatch(/ref: acknowledgeRef \} = usePendingControl\(\)/)
    expect(file('chain-panel.tsx')).toMatch(/ref=\{acknowledgeRef\}/)
    expect(file('export-audit-dialog.tsx')).toMatch(/ref: exportRef \} = usePendingControl\(\)/)
    expect(file('export-audit-dialog.tsx')).toMatch(/ref=\{exportRef\}/)
  })

  it('MD-6, TS-15: no file loads the typed client or the Live source, builds a client, opens a socket or imports a test double', () => {
    for (const { name, text } of production) {
      const source = code(text)
      expect(source, name).not.toMatch(/from '@dems\/shared\/(client|live\/source|live\/testing)'/)
      expect(source, name).not.toMatch(/createCoreClient|createLiveSim|runtime\/(testing|live-start|boot)|new WebSocket/)
    }
  })

  it('error logging (CPW1-8): no console; the page\'s record goes through the one page reporter with a fixed sentence', () => {
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/console\.(error|warn|log)/)
    const log = file('log.ts')
    expect(log).toMatch(/createPageReporter\('sa'\)/)
    expect(log).toMatch(/from '@\/lib\/page-report'/)
    expect(log).not.toMatch(/message:\s*error|error\.message|String\(error\)|error\.stack|import\.meta\.env\.DEV/)
  })

  it('rule 4: the export reason never reaches a record (only its length; the refusal by its enum)', () => {
    /** Every `logSecurityAudit(...)` call of a source, by balanced parentheses. */
    const logCalls = (source: string): string[] => {
      const out: string[] = []
      for (let at = source.indexOf('logSecurityAudit('); at >= 0; at = source.indexOf('logSecurityAudit(', at + 1)) {
        let depth = 0
        for (let index = at + 'logSecurityAudit'.length; index < source.length; index += 1) {
          if (source[index] === '(') depth += 1
          else if (source[index] === ')' && --depth === 0) {
            out.push(source.slice(at, index + 1))
            break
          }
        }
      }
      return out
    }
    const calls = production.flatMap(({ text }) => logCalls(code(text)))
    expect(calls.length).toBeGreaterThanOrEqual(8)
    for (const call of calls) {
      const rest = call.replace(/reasonText\.trim\(\)\.length|reason\.trim\(\)\.length|outcome\.reason|reasonLength/g, '')
      expect(rest, call).not.toMatch(/\breason(Text)?\b/)
    }
  })
})
