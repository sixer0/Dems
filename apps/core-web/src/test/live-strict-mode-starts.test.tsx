/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W0, item 1 (finding F69-1, decision D158 DC-2): a Core command started from a mount
// effect must reach the Core ONCE under React StrictMode, which `main.tsx` renders and which runs
// every effect twice on mount in every dev build — where Live mode lives. The one way is
// `deferEffectStart` (`lib/effect-start.ts`), returned by the effect.
//
// | Case | Where it is proven |
// |------|--------------------|
// | The helper: one task later; the clean-up cancels; under StrictMode one start where a direct call starts two | "the helper" |
// | Session New, the B-6 resume effect, Simulated mode: one `beginPrecheck`, no failure toast (two before W0) | "Session New resume, Simulated" |
// | Session New, the B-6 resume effect, Live mode: one request | `live-session-new-precheck.test.tsx` "StrictMode runs the effect twice" (W64, unchanged) |
// | Evidence, the list's Verify hand-off and the wizard's source check: one request each | `live-evidence-verify.test.tsx` "StrictMode" (W69, unchanged) |
// | Safe by construction — Evidence detail, operation 40 in a query: one request | "safe cases" |
// | Safe by construction — the device drawer's paired list, operation 19 in a query, and its ref-guarded refresh: one request | "safe cases" |
// | No file under `features/` starts a command from an effect without returning the helper | "the static guard" (with positive and negative controls) |
import { StrictMode, useEffect } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { EV, findDetailBody, installJsdomStubs, openLiveEvidence } from '@/features/evidence/__tests__/live-evidence-bed'
import { FORM_INPUT, stubMediaForJsdom, toastsWith } from '@/features/session-new/__tests__/live-session-new-bed'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { deferEffectStart } from '@/lib/effect-start'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

vi.setConfig({ testTimeout: 40_000 })

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

const AS_OF = Date.parse('2026-10-01T03:00:00.000Z')
const sims: Sim[] = []
const beds: LiveTestBed[] = []

/** A Simulated page load under StrictMode (as `main.tsx` renders it), the simulator prepared by `prepare`. */
function mountSimulated(path: string, prepare: (sim: Sim) => void): Sim {
  const clock = createManualClock(AS_OF)
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: AS_OF })
  const sim = createSim({ scenario: 'idle', storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined, clock })
  sims.push(sim)
  prepare(sim)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter({ sim, queryClient, socketFactory: () => new SilentSocket() }, { history: createMemoryHistory({ initialEntries: [path] }) })
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
  return sim
}

const originalMatchMedia = window.matchMedia
/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
async function clearToasts(): Promise<void> {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
  resetCoreErrorPresenter()
}

let restoreMedia: () => void = () => undefined
beforeAll(() => {
  restoreMedia = stubMediaForJsdom()
})
afterAll(() => restoreMedia())

beforeEach(async () => {
  await clearToasts()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  for (const sim of sims.splice(0)) sim.stop()
  for (const bed of beds.splice(0)) bed.dispose()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the helper: `deferEffectStart` starts one task later and its clean-up cancels', () => {
  it('nothing runs in the call; the start runs after one task', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const start = vi.fn()
    deferEffectStart(start)
    expect(start).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('set-up, clean-up, set-up (what StrictMode does on mount): ONE start', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const start = vi.fn()
    const first = deferEffectStart(start)
    first()
    const second = deferEffectStart(start)
    vi.runAllTimers()
    expect(start).toHaveBeenCalledTimes(1)
    // The clean-up after the start is harmless.
    second()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('under StrictMode a mount effect that returns the helper starts once; the same effect calling directly starts twice (the control)', async () => {
    const helped = vi.fn()
    const direct = vi.fn()
    function Helped() {
      useEffect(() => deferEffectStart(helped), [])
      return null
    }
    function Direct() {
      useEffect(() => {
        direct()
      }, [])
      return null
    }
    render(
      <StrictMode>
        <Helped />
        <Direct />
      </StrictMode>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(direct).toHaveBeenCalledTimes(2)
    expect(helped).toHaveBeenCalledTimes(1)
  })
})

describe('Session New resume, Simulated: the B-6 resume effect starts ONE pre-check under StrictMode', () => {
  it('a session left in CREATE, the page opened at step 2: one `beginPrecheck`, no failure toast, the gate runs', async () => {
    let calls = 0
    const sim = mountSimulated('/session/new?step=2', (prepared) => {
      const created = prepared.actions.createSession({ ...FORM_INPUT, investigatorId: OPERATOR_IDS.BUDI })
      if (!created.ok) throw new Error(`the simulator could not create a session: ${created.reason}`)
      const original = prepared.actions.beginPrecheck.bind(prepared.actions)
      vi.spyOn(prepared.actions, 'beginPrecheck').mockImplementation(() => {
        calls += 1
        original()
      })
    })
    const page = await screen.findByTestId('page-session-new', {}, { timeout: 20_000 })
    await waitFor(() => expect(page).toHaveAttribute('data-step', '2'))
    await waitFor(() => expect(sim.store.getState().session?.state).toBe('PRECHECK'))
    // Well past the one task the start waits: still one.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(calls).toBe(1)
    expect(toastsWith(en.sessionNew.errors.precheck)).toHaveLength(0)
    expect(webErrorSink.records().filter((record) => record.source.includes('beginPrecheck'))).toEqual([])
  })
})

describe('safe cases: a query started on mount is fetched once under StrictMode (TanStack Query shares one fetch)', () => {
  it('Evidence detail: operation 40 (`getEvidence`) is requested ONCE', async () => {
    installJsdomStubs()
    const opened = await openLiveEvidence(`/evidence/${EV.sealed}`, { strict: true })
    beds.push(opened.bed)
    await findDetailBody()
    await opened.bed.flush()
    expect(opened.bed.fake.log.requestsOf('getEvidence')).toHaveLength(1)
  })

  it('the device drawer: operation 19 (`listPairedDevices`) is requested ONCE when the drawer mounts; the ref-guarded refresh sends nothing on mount', async () => {
    installJsdomStubs()
    const bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    beds.push(bed)
    bed.fake.answerFromExample('listPairedDevices')
    const page = await bed.load()
    await bed.mount(page, '/devices', { strict: true })
    await screen.findByTestId('page-devices', {}, { timeout: 15_000 })
    fireEvent.click(await screen.findByTestId('other-TABLET'))
    const drawer = await screen.findByTestId('device-drawer')
    await waitFor(() => expect(within(drawer).getByTestId('drawer-paired-summary')).toBeInTheDocument())
    await bed.flush()
    expect(bed.fake.log.requestsOf('listPairedDevices')).toHaveLength(1)
  })
})

// ── The static guard ──────────────────────────────────────────────────────────────────────────
//
// Reads the code (comments and quoted strings removed) of every production `.ts`/`.tsx` file under
// `src/features/**` (test folders excluded), finds every `useEffect`, `useLayoutEffect` and
// `useInsertionEffect` call, and fails when its callback names a Core call OUTSIDE the argument of
// `deferEffectStart(...)`, or names one only inside it but does not return the helper.

const FEATURES = resolve(import.meta.dirname, '../features')

/** What starts a Core command or query: an action, an operation, a query refresh, a call through a ref, the actions handed to a helper. */
const CORE_CALL =
  /\bsettle\s*\(|\bactions\s*\.\s*[A-Za-z_$][\w$]*\s*\(|\bclient\s*\.\s*call\s*\(|\b(?:invalidateQueries|refetchQueries|resetQueries|fetchQuery|prefetchQuery|ensureQueryData|refetch|mutate|mutateAsync)\s*\(|(?<![\w$.])fetch\s*\(|\.current\s*\(|[(,]\s*actions\s*[,)]/

/**
 * Effects that name a Core call and are safe without the helper, each with its reason. Matched by
 * file and the token found; a new effect in the same file with another token is not covered.
 */
const ALLOWED: readonly { file: string; token: string; why: string }[] = [
  {
    file: 'devices/device-drawer.tsx',
    token: 'invalidateQueries(',
    why: 'CONTRACT-GAP-W70-1 refresh: the ref starts at the mount value of `tabletLink.changedAt`, so the mount run and StrictMode\'s second run send nothing; a later change runs once (no remount)',
  },
]

function productionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'testing' ? [] : productionFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : []
  })
}

/** Comments and quoted strings blanked (line breaks kept, so line numbers stay true). */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
}

/** The text from `open` (an index just after an opening parenthesis) to its closing one. */
function balanced(text: string, open: number): string {
  let depth = 1
  let index = open
  while (index < text.length && depth > 0) {
    const char = text[index]
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    index += 1
  }
  return text.slice(open, index - 1)
}

/** The callback text with every `deferEffectStart(...)` argument removed. */
function outsideHelper(body: string): string {
  let rest = body
  let at = rest.search(/\bdeferEffectStart\s*\(/)
  while (at >= 0) {
    const open = rest.indexOf('(', at) + 1
    const inner = balanced(rest, open)
    rest = `${rest.slice(0, at)}HELPER${rest.slice(open + inner.length + 1)}`
    at = rest.search(/\bdeferEffectStart\s*\(/)
  }
  return rest
}

interface Finding {
  line: number
  token: string
  problem: 'outside the helper' | 'the helper is not returned'
}

/** Every effect of `source` that starts a Core call the wrong way. */
function findings(source: string): Finding[] {
  const text = code(source)
  const found: Finding[] = []
  for (const match of text.matchAll(/\buse(?:Layout|Insertion)?Effect\s*\(/g)) {
    const start = (match.index ?? 0) + match[0].length
    // The callback only: the dependency list names `actions` without calling anything.
    const body = balanced(text, start).replace(/,\s*\[[^[\]]*\]\s*,?\s*$/, '')
    const line = text.slice(0, match.index).split('\n').length
    const outside = outsideHelper(body).match(CORE_CALL)
    if (outside) {
      found.push({ line, token: outside[0].replace(/\s+/g, ''), problem: 'outside the helper' })
      continue
    }
    const inside = body.match(CORE_CALL)
    if (inside && !/(?:\breturn\s+|=>\s*)deferEffectStart\s*\(/.test(body)) {
      found.push({ line, token: inside[0].replace(/\s+/g, ''), problem: 'the helper is not returned' })
    }
  }
  return found
}

/** The findings of `files` that no entry of `allowed` names, as `file:line token — problem`. */
function offendingIn(files: readonly { file: string; text: string }[], allowed: typeof ALLOWED): string[] {
  const offending: string[] = []
  for (const { file, text } of files) {
    for (const finding of findings(text)) {
      if (allowed.some((entry) => entry.file === file && entry.token === finding.token)) continue
      offending.push(`${file}:${finding.line} ${finding.token} — ${finding.problem}`)
    }
  }
  return offending
}

describe('the static guard: a file under `features/` starts a Core call from an effect only by returning `deferEffectStart`', () => {
  const files = productionFiles(FEATURES).map((path) => ({ file: path.slice(FEATURES.length + 1).split('\\').join('/'), text: readFileSync(path, 'utf8') }))

  it('reads every page folder', () => {
    expect(files.length).toBeGreaterThan(150)
    expect(files.map(({ file }) => file)).toEqual(
      expect.arrayContaining(['session-new/index.tsx', 'evidence/detail-page.tsx', 'evidence/export-wizard.tsx', 'devices/device-drawer.tsx', 'dashboard/devices-panel.tsx', 'storage/manage-drawer.tsx', 'network-time/index.tsx', 'session-monitor/integrity-panel.tsx']),
    )
  })

  it('positive controls: each shape that sends twice under StrictMode, or hides how, is found', () => {
    // The Session New resume effect before W0: a ref-guarded settle in the set-up.
    expect(findings(`useEffect(() => {
      if (precheckInFlight.current === sessionId) return
      precheckInFlight.current = id
      settle(() => actions.beginPrecheck(), { fail: () => undefined })
    }, [id])`)).toEqual([{ line: 1, token: 'settle(', problem: 'outside the helper' }])
    // W69's hand-rolled deferral: safe, but not the one way (a copy per folder is what W0 removes).
    expect(findings(`useEffect(() => {
      const start = setTimeout(() => void runRef.current(), 0)
      return () => clearTimeout(start)
    }, [])`)).toEqual([{ line: 1, token: '.current(', problem: 'outside the helper' }])
    expect(findings(`useLayoutEffect(() => { void live.client.call('getEvidence', input) }, [])`)[0]?.token).toBe('client.call(')
    expect(findings(`useEffect(() => { void query.refetch() }, [])`)[0]?.token).toBe('refetch(')
    expect(findings(`useEffect(() => { queryClient.invalidateQueries({ queryKey }) }, [key])`)[0]?.token).toBe('invalidateQueries(')
    expect(findings(`useEffect(function seed() { actions.updateSettings(stored) }, [actions])`)[0]?.token).toBe('actions.updateSettings(')
    expect(findings(`useEffect(() => { scanCaseNumber(actions, getState, onError) }, [])`)[0]?.token).toBe('(actions,')
    expect(findings(`useEffect(() => { recordPackageVerification(state, actions) }, [state])`)[0]?.token).toBe(',actions)')
    expect(findings(`useEffect(() => { void fetch('/api/v1/health') }, [])`)[0]?.token).toBe('fetch(')
    // The helper called but not returned: StrictMode's clean-up cannot cancel it.
    expect(findings(`useEffect(() => { deferEffectStart(() => settle(() => actions.verify(id), handlers)) }, [])`)).toEqual([
      { line: 1, token: 'settle(', problem: 'the helper is not returned' },
    ])
    // A command beside a returned helper is still a command in the set-up.
    expect(findings(`useEffect(() => {
      settle(() => actions.addNote(text), handlers)
      return deferEffectStart(() => undefined)
    }, [])`)[0]).toMatchObject({ token: 'settle(', problem: 'outside the helper' })
  })

  it('negative controls: the helper returned, and effects that start no Core call, are not found', () => {
    expect(findings(`useEffect(() => deferEffectStart(() => void runRef.current()), [])`)).toEqual([])
    expect(findings(`useEffect(() => {
      if (step !== 2 || sessionId === null) return undefined
      const id = sessionId
      return deferEffectStart(() => {
        if (precheckInFlight.current === id) return
        settle(() => actions.beginPrecheck(), { fail: (error) => { if (presentCoreError(error) !== null) return } })
      })
    }, [step, sessionId])`)).toEqual([])
    expect(findings(`useEffect(() => {
      const timer = setTimeout(() => setRevealed(true), delayMs)
      return () => clearTimeout(timer)
    }, [busy])`)).toEqual([])
    expect(findings(`useEffect(() => { toast.success(t('common.actions.retry')) }, [count])`)).toEqual([])
    // The dependency list names the actions object; that starts nothing.
    expect(findings(`useEffect(() => { setReady(true) }, [step, actions, sessionId])`)).toEqual([])
    // A comment or a string that names a call is no call.
    expect(findings(`useEffect(() => {
      // settle(() => actions.verify(id)) is what the button does
      setLabel('actions.verify(id)')
    }, [])`)).toEqual([])
    // A call of the same name outside an effect is an event handler: not this guard's business.
    expect(findings(`const onPress = () => settle(() => actions.verify(id), handlers)`)).toEqual([])
  })

  it('the allowed list covers its own file and token only (a control on two made-up files)', () => {
    const shape = 'useEffect(() => { void queryClient.invalidateQueries({ queryKey }) }, [key])'
    const allowed = [{ file: 'a/allowed.tsx', token: 'invalidateQueries(', why: 'a made-up entry of this control, long enough to pass the length rule' }]
    expect(offendingIn([{ file: 'a/allowed.tsx', text: shape }], allowed)).toEqual([])
    expect(offendingIn([{ file: 'b/other.tsx', text: shape }], allowed)).toEqual(['b/other.tsx:1 invalidateQueries( — outside the helper'])
    expect(offendingIn([{ file: 'a/allowed.tsx', text: 'useEffect(() => { void query.refetch() }, [])' }], allowed)).toEqual(['a/allowed.tsx:1 refetch( — outside the helper'])
  })

  it('every production file of `features/` holds the rule (the allowed list names each exception and why)', () => {
    expect(offendingIn(files, ALLOWED)).toEqual([])
    for (const entry of ALLOWED) expect(entry.why.length, entry.file).toBeGreaterThan(40)
  })
})
