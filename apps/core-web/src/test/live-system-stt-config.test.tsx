/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Task 3 blueprint row 117 (R-8; ux §8a flow 8; C3 §2.5 operations 90-92): the Transcription (STT)
// item of Settings, rendered in ISOLATION (decision D95: the Settings panel mounts it with one line,
// owned by row 67) in Live mode on the contract-checked fake transport.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | G11/G12 show "Checking your permissions…" first, disabled; then enabled for `CAPTURE_CONFIG` | "gating" |
// | INVESTIGATOR: Checking, then every control disabled with the role sentence; nothing is sent | "gating" |
// | Save: ONE POST with `revision` and the changed members; `model` trimmed; op 90 read again | "save" |
// | `appliesFrom: NEXT_SESSION` → the banner "Saved — applies to the next session" | "save" |
// | 409 REVISION_CONFLICT → reload prompt; 422 ENDPOINT_NOT_LOOPBACK → the field's message | "refusals" |
// | Credential: never pre-filled; "set / not set" and the kind only; emptied on save, on close, on closing the item | "credential" |
// | D70 R-3: a refused or failed credential save reports NO value: sink, console, toasts, DOM, query cache (canary) | "credential canary" |
// | Test connection: 503 TRANSCRIBER_NOT_READY is an inline notice; `reachable: false` an inline result | "test connection" |
// | Simulated mode: a one-line note, nothing is sent | "Simulated mode" |
// | Static: no console, no storage, no `useMutation` in the section's files; op 91 on the Try-it deny list | "static rules" |
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Accordion, toast, ToastProvider } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_API_EXAMPLES, type AuthSessionInfo } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { HeartbeatContext } from '@dems/shared/realtime'
import { createManualClock, createSim, SimProvider } from '@dems/shared/sim'
import { getMissingI18nKeys, i18n, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { MotionPolicyProvider } from '@/motion'
import { webErrorSink } from '@/runtime'
import { applyCoreQueryDefaults } from '@/runtime/query-bridge'
import { createLiveTestBed, INVESTIGATOR_SESSION, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'
import { STT_CONFIG_QUERY_KEY } from '@/features/system/stt-config-queries'
import { SttSettingsItem } from '@/features/system/stt-config-section'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const T = en.system.stt
const CANARY = 'CANARY-7f3kQ9-do-not-leak'
const TECHNICIAN_SESSION: Pick<AuthSessionInfo, 'operator' | 'permissions'> = {
  operator: { ...SUPERVISOR_SESSION.operator, role: 'TECHNICIAN' },
  permissions: ['CAPTURE_CONFIG'] as AuthSessionInfo['permissions'],
}

const originalMatchMedia = window.matchMedia
async function clearToasts() {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((done) => setTimeout(done, 350))
}
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')

Element.prototype.scrollIntoView ??= function scrollIntoView() {}

let bed: LiveTestBed | undefined
let queryClient: QueryClient | undefined
let page: LivePage | undefined
let consoleCalls: unknown[][] = []
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)

/** The item inside an accordion and the providers of the root route, around the bed's Live source.
 *  The default driver is the TECHNICIAN: since the 0034 revocation (2026-10-29, re-pinned across
 *  the web rows on 2026-11-03) CAPTURE_CONFIG — the gate of this page — is the technician's alone. */
async function mountItem(session: Pick<AuthSessionInfo, 'operator' | 'permissions'> = TECHNICIAN_SESSION, script: (bed: LiveTestBed) => void = (b) => b.fake.answerFromExample('getSttConfig', 200, 'seeded')) {
  const created = createLiveTestBed({ session })
  bed = created
  script(created)
  page = await created.load()
  queryClient = new QueryClient()
  applyCoreQueryDefaults(queryClient)
  render(
    <QueryClientProvider client={queryClient}>
      <HeartbeatContext.Provider value={page.live.heartbeat}>
        <SimProvider sim={page.runtime.sim} autoStart={false}>
          <I18nextProvider i18n={i18n}>
            <MotionPolicyProvider>
              <Accordion allowsMultipleExpanded>
                <SttSettingsItem />
              </Accordion>
              <ToastProvider />
            </MotionPolicyProvider>
          </I18nextProvider>
        </SimProvider>
      </HeartbeatContext.Provider>
    </QueryClientProvider>,
  )
  return created
}

const item = () => screen.getByTestId('system-settings-transcription')
const toggleItem = () => fireEvent.click(within(item()).getAllByRole('button')[0]!)
async function openItem(expected: 'allowed' | 'refused' | 'checking' = 'allowed') {
  toggleItem()
  const section = await screen.findByTestId('stt-config')
  await waitFor(() => expect(section).toHaveAttribute('data-access', expected))
  return section
}
const input = (testId: string) => screen.getByTestId(testId) as HTMLInputElement
const type = (testId: string, text: string) => fireEvent.change(input(testId), { target: { value: text } })
const press = (testId: string) => fireEvent.click(screen.getByTestId(testId))
const disabled = (testId: string) => {
  const element = screen.getByTestId(testId)
  return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('data-disabled')
}
const switchInput = (testId: string) => within(screen.getByTestId(testId)).getByRole('switch') as HTMLInputElement

async function pickBackend(name: string) {
  fireEvent.click(within(screen.getByTestId('stt-backend')).getByRole('button'))
  fireEvent.click(await screen.findByRole('option', { name }))
}

/** Every place a value could be reported or kept, as one text: the two sinks, the console, toasts, the rendered text, the query cache. */
function reported(): string {
  // The write-only field itself is the one legitimate place of the typed text: it is left out of the markup.
  const markup = document.body.cloneNode(true) as HTMLElement
  markup.querySelector('[data-testid="stt-credential-input"]')?.remove()
  return JSON.stringify({
    sink: webErrorSink.records(),
    pageSink: page!.sink.records(),
    console: consoleCalls.map((call) => call.map((part) => (part instanceof Error ? `${part.message} ${part.stack}` : part))),
    toasts: toastTexts(),
    dom: document.body.textContent,
    html: markup.innerHTML,
    cache: queryClient!.getQueryCache().getAll().map((query) => ({ key: query.queryKey, state: query.state.data, error: String(query.state.error) })),
    mutations: queryClient!.getMutationCache().getAll().length,
    storage: [JSON.stringify({ ...window.localStorage }), JSON.stringify({ ...window.sessionStorage })],
    urls: bed!.fake.log.urls(),
  })
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  consoleCalls = []
  for (const level of ['error', 'warn', 'log', 'info', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void consoleCalls.push(parts))
  }
})

afterEach(async () => {
  expect(getMissingI18nKeys()).toEqual([])
  cleanup()
  await clearToasts()
  bed?.dispose()
  bed = undefined
  page = undefined
  queryClient = undefined
  vi.restoreAllMocks()
})

describe('gating (G11 Save, G12 Test connection)', () => {
  it('closed item: nothing is read', async () => {
    await mountItem()
    expect(screen.queryByTestId('stt-config')).toBeNull()
    expect(requests('getSttConfig')).toHaveLength(0)
  })

  // SUPERVISOR used to be the enabled half of this row. The 0034 revocation (2026-10-29) moved
  // CAPTURE_CONFIG to the technician alone, so the gate — read client-side off the session's
  // permissions — now lands the supervisor on the refused side even when the read answers 200.
  // The enabled story is the TECHNICIAN row below's.
  it('SUPERVISOR: "Checking your permissions…" with both controls disabled, then refused (0034)', async () => {
    let held: ReturnType<LiveTestBed['fake']['hold']> | undefined
    const created = await mountItem(SUPERVISOR_SESSION, (b) => {
      held = b.fake.hold('getSttConfig')
    })
    await openItem('checking')
    expect(screen.getByTestId('stt-access')).toHaveTextContent(T.checking)
    expect(disabled('stt-save')).toBe(true)
    expect(disabled('stt-test')).toBe(true)
    await act(async () => held!.release(created.fake.example('getSttConfig', 200, 'seeded')))
    await waitFor(() => expect(screen.getByTestId('stt-config')).toHaveAttribute('data-access', 'refused'))
    expect(screen.getByTestId('stt-access')).not.toHaveTextContent(T.checking)
    expect(disabled('stt-save')).toBe(true)
    expect(disabled('stt-test')).toBe(true)
  })

  it('TECHNICIAN holds CAPTURE_CONFIG: enabled', async () => {
    await mountItem(TECHNICIAN_SESSION)
    await openItem('allowed')
    expect(disabled('stt-save')).toBe(false)
  })

  it('INVESTIGATOR: Checking, then every control disabled with the reason; a press sends nothing', async () => {
    let held: ReturnType<LiveTestBed['fake']['hold']> | undefined
    const created = await mountItem(INVESTIGATOR_SESSION, (b) => {
      held = b.fake.hold('getSttConfig')
    })
    await openItem('checking')
    expect(screen.getByTestId('stt-access')).toHaveTextContent(T.checking)
    await act(async () => held!.release(created.fake.example('getSttConfig', 200, 'seeded')))
    await waitFor(() => expect(screen.getByTestId('stt-config')).toHaveAttribute('data-access', 'refused'))
    // G81-03 (gate 81): the hint names EVERY role the access rule admits - and since the 0034
    // revocation (2026-10-29, re-pinned 2026-11-03) `CAPTURE_CONFIG` admits the TECHNICIAN alone.
    expect(screen.getByTestId('stt-access')).toHaveTextContent(`Read-only: ${en.common.rbac.requiresRole.replace('{{role}}', en.common.roles.TECHNICIAN)}.`)
    expect(screen.getByTestId('stt-access').textContent).toBe('Read-only: Requires the Technician role.')
    for (const control of ['stt-save', 'stt-test', 'stt-credential-change']) expect(disabled(control)).toBe(true)
    expect(switchInput('stt-enabled').disabled).toBe(true)
    expect(switchInput('stt-diarization').disabled).toBe(true)
    expect(input('stt-model').disabled).toBe(true)
    // The read-only view still shows the stored values.
    expect(input('stt-model').value).toBe((created.fake.example('getSttConfig', 200, 'seeded').body as { model: string }).model)
    press('stt-save')
    press('stt-test')
    await created.flush()
    expect(requests('updateSttConfig')).toHaveLength(0)
    expect(requests('testSttConnection')).toHaveLength(0)
  })
})

describe('save (operation 91)', () => {
  it('one POST with the revision and the changed members; model trimmed; applies now; op 90 read again', async () => {
    const created = await mountItem()
    await openItem()
    const model = (created.fake.example('getSttConfig', 200, 'seeded').body as { model: string }).model
    fireEvent.click(switchInput('stt-diarization'))
    type('stt-model', `  ${model}-x  `)
    created.fake.answerOnceFromExample('updateSttConfig', 200, 'idle')
    const readsBefore = requests('getSttConfig').length
    press('stt-save')
    await waitFor(() => expect(requests('updateSttConfig')).toHaveLength(1))
    expect(requests('updateSttConfig')[0]).toMatchObject({ method: 'POST' })
    expect(requests('updateSttConfig')[0]!.body).toEqual({ revision: 1, model: `${model}-x`, diarization: false })
    await waitFor(() => expect(toastTexts().some((text) => text.includes(T.saved))).toBe(true))
    await waitFor(() => expect(requests('getSttConfig').length).toBeGreaterThan(readsBefore))
    expect(screen.queryByTestId('stt-saved-next')).toBeNull()
  })

  it('a session is open: the banner "Saved — applies to the next session"', async () => {
    const created = await mountItem()
    await openItem()
    fireEvent.click(switchInput('stt-enabled'))
    created.fake.answerOnceFromExample('updateSttConfig', 200, 'sessionOpen')
    press('stt-save')
    expect(await screen.findByTestId('stt-saved-next')).toHaveTextContent(T.savedNextSession)
    expect(requests('updateSttConfig')[0]!.body).toEqual({ revision: 1, enabled: false })
  })

  it('nothing changed: nothing is sent', async () => {
    const created = await mountItem()
    await openItem()
    press('stt-save')
    await created.flush()
    expect(requests('updateSttConfig')).toHaveLength(0)
  })

  it('an invalid model is refused in the form: the field says so, nothing is sent', async () => {
    const created = await mountItem()
    await openItem()
    type('stt-model', 'two words.bin')
    press('stt-save')
    expect(await screen.findByTestId('stt-model-error')).toHaveTextContent(T.modelInvalid)
    await created.flush()
    expect(requests('updateSttConfig')).toHaveLength(0)
  })
})

// Fix wave K, driver W (G81b-05; `delegation_progress/contract_wave_k.md` S2 section 4): the sentence
// "A saved change is waiting: it applies to the next session." is drawn from the member
// `pendingForNextSession` of operation 90, read BY NAME - and only when the Core says the fact is true
// (it is true only while a session that is not yet ended holds an older snapshot).
describe('G81b-05: the pending-change sentence follows `pendingForNextSession` by name', () => {
  const examples = (CORE_API_EXAMPLES.getSttConfig ?? { responses: {} }).responses[200] as Record<string, { value: Record<string, unknown> }>
  const seeded = examples['seeded']!.value
  const answering = (pendingForNextSession: boolean) => (b: LiveTestBed) => b.fake.answer('getSttConfig', () => ({ status: 200, body: { ...seeded, pendingForNextSession } }) as never)

  it('the Core says a change is waiting (a session is open): the sentence is shown', async () => {
    await mountItem(undefined, answering(true))
    await openItem()
    expect(await screen.findByTestId('stt-pending-next')).toHaveTextContent(T.pendingNextSession)
  })

  it('the Core says nothing is waiting (no session is open): no sentence - the contract example itself states `false`', async () => {
    expect(seeded.pendingForNextSession).toBe(false)
    await mountItem(undefined, answering(false))
    await openItem()
    expect(screen.queryByTestId('stt-pending-next')).toBeNull()
    expect(screen.getByTestId('stt-config')).not.toHaveTextContent(T.pendingNextSession)
  })
})

describe('refusals', () => {
  it('a non-loopback address: the field message, nothing sent; the Core\'s 422 ENDPOINT_NOT_LOOPBACK gets the same message', async () => {
    const created = await mountItem()
    await openItem()
    expect(screen.queryByTestId('stt-endpoint')).toBeNull()
    await pickBackend(T.backends['omlx-server'])
    type('stt-endpoint', 'http://192.168.1.9:8000')
    press('stt-save')
    expect(await screen.findByTestId('stt-endpoint-error')).toHaveTextContent(T.endpointNotLoopback)
    expect(requests('updateSttConfig')).toHaveLength(0)

    type('stt-endpoint', 'http://127.0.0.1:8000')
    await waitFor(() => expect(screen.queryByTestId('stt-endpoint-error')).toBeNull())
    created.fake.answerOnceFromExample('updateSttConfig', 422, 'endpointNotLoopback')
    press('stt-save')
    expect(await screen.findByTestId('stt-endpoint-error')).toHaveTextContent(T.endpointNotLoopback)
    expect(requests('updateSttConfig')[0]!.body).toEqual({ revision: 1, backend: 'omlx-server', endpoint: 'http://127.0.0.1:8000' })
    expect(toastTexts()).toEqual([])
  })

  it('409 REVISION_CONFLICT: the reload prompt; Reload reads operation 90 again and drops the edit', async () => {
    const created = await mountItem()
    await openItem()
    fireEvent.click(switchInput('stt-diarization'))
    created.fake.answerOnceFromExample('updateSttConfig', 409, 'revisionConflict')
    press('stt-save')
    expect(await screen.findByTestId('stt-conflict')).toHaveTextContent(T.conflict)
    expect(disabled('stt-save')).toBe(true)
    expect(toastTexts()).toEqual([])
    const readsBefore = requests('getSttConfig').length
    created.fake.answerFromExample('getSttConfig', 200, 'edited')
    press('stt-reload')
    await waitFor(() => expect(requests('getSttConfig').length).toBeGreaterThan(readsBefore))
    await waitFor(() => expect(screen.queryByTestId('stt-conflict')).toBeNull())
    await waitFor(() => expect(screen.getByTestId('stt-credential-state')).toHaveTextContent(`${T.credentialSet} · ${T.credentialKinds.REFERENCE}`))
    expect(disabled('stt-save')).toBe(false)
  })
})

describe('credential (write-only)', () => {
  it('never pre-filled: no field until the operator opens it, and it opens empty also when a credential is set', async () => {
    await mountItem(undefined, (b) => b.fake.answerFromExample('getSttConfig', 200, 'edited'))
    await openItem()
    expect(screen.getByTestId('stt-credential-state')).toHaveTextContent(`${T.credentialSet} · ${T.credentialKinds.REFERENCE}`)
    expect(screen.queryByTestId('stt-credential-input')).toBeNull()
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0)
    press('stt-credential-change')
    expect(input('stt-credential-input').value).toBe('')
    expect(input('stt-credential-input').getAttribute('autocomplete')).toBe('off')
    // Before blueprint row 84 the reference form only: no choice of form, no password field.
    expect(screen.queryByTestId('stt-credential-kind')).toBeNull()
    expect(input('stt-credential-input').type).toBe('text')
  })

  it('"not set" for the seeded configuration; Remove is offered only when one is set', async () => {
    await mountItem()
    await openItem()
    expect(screen.getByTestId('stt-credential-state')).toHaveTextContent(T.credentialNotSet)
    expect(screen.queryByTestId('stt-credential-remove')).toBeNull()
  })

  it('Close empties the field; closing the item unmounts the form and it comes back empty', async () => {
    await mountItem()
    await openItem()
    press('stt-credential-change')
    type('stt-credential-input', `omlx-settings:${CANARY}`)
    press('stt-credential-close')
    expect(screen.queryByTestId('stt-credential-input')).toBeNull()
    press('stt-credential-change')
    expect(input('stt-credential-input').value).toBe('')

    type('stt-credential-input', `omlx-settings:${CANARY}`)
    toggleItem()
    await waitFor(() => expect(screen.queryByTestId('stt-config')).toBeNull())
    expect(document.body.innerHTML).not.toContain('CANARY')
    await openItem()
    expect(screen.queryByTestId('stt-credential-input')).toBeNull()
    expect(reported()).not.toContain('CANARY')
  })

  it('a reference is sent once as `credential: { kind: REFERENCE, ref }` and the field is gone after the save', async () => {
    const created = await mountItem()
    await openItem()
    press('stt-credential-change')
    type('stt-credential-input', ' omlx-settings:auth.api_key ')
    created.fake.answerOnceFromExample('updateSttConfig', 200, 'idle')
    created.fake.answerFromExample('getSttConfig', 200, 'edited')
    press('stt-save')
    await waitFor(() => expect(requests('updateSttConfig')).toHaveLength(1))
    expect(requests('updateSttConfig')[0]!.body).toEqual({ revision: 1, credential: { kind: 'REFERENCE', ref: 'omlx-settings:auth.api_key' } })
    await waitFor(() => expect(screen.queryByTestId('stt-credential-input')).toBeNull())
    await waitFor(() => expect(screen.getByTestId('stt-credential-state')).toHaveTextContent(T.credentialSet))
    expect(document.body.innerHTML).not.toContain('auth.api_key')
  })

  it('Remove sends `credential: { kind: CLEAR }`', async () => {
    const created = await mountItem(undefined, (b) => b.fake.answerFromExample('getSttConfig', 200, 'edited'))
    await openItem()
    press('stt-credential-remove')
    expect(screen.getByTestId('stt-credential-remove-pending')).toHaveTextContent(T.credentialRemovePending)
    created.fake.answerOnceFromExample('updateSttConfig', 200, 'idle')
    press('stt-save')
    await waitFor(() => expect(requests('updateSttConfig')).toHaveLength(1))
    expect(requests('updateSttConfig')[0]!.body).toEqual({ revision: 2, credential: { kind: 'CLEAR' } })
  })
})

describe('credential canary (D70 R-3): a refused or failed save reports no value anywhere', () => {
  it('refused in the form: the field message only; nothing sent, nothing reported', async () => {
    const created = await mountItem()
    await openItem()
    press('stt-credential-change')
    type('stt-credential-input', `not a reference ${CANARY}`)
    press('stt-save')
    expect(await screen.findByTestId('stt-credential-error')).toHaveTextContent(T.credentialRefInvalid)
    await created.flush()
    expect(requests('updateSttConfig')).toHaveLength(0)
    // The text is still in the field for the operator to correct (its `value`), and nowhere else.
    expect(input('stt-credential-input').value).toContain(CANARY)
    expect(reported()).not.toContain('CANARY')
    expect(webErrorSink.records()).toEqual([])
  })

  const failures: ReadonlyArray<readonly [string, (bed: LiveTestBed) => void]> = [
    ['422 INVALID_INPUT', (b) => b.fake.answerOnceFromExample('updateSttConfig', 422, 'invalidInput')],
    ['409 REVISION_CONFLICT', (b) => b.fake.answerOnceFromExample('updateSttConfig', 409, 'revisionConflict')],
    ['403 NOT_PERMITTED', (b) => b.fake.answerOnceFromExample('updateSttConfig', 403)],
    ['an outage', (b) => b.fake.failOnce('updateSttConfig')],
    [
      '503 CREDENTIAL_STORE_NOT_READY',
      (b) =>
        b.fake.answerOnce('updateSttConfig', {
          status: 503,
          body: { error: { code: 'NOT_READY', message: 'The Core credential store is not mounted.', details: { reason: 'CREDENTIAL_STORE_NOT_READY' } } },
        }),
    ],
  ]

  it.each(failures)('the Core answers %s: sent once, the field emptied, no value reported', async (_name, script) => {
    const created = await mountItem()
    await openItem()
    press('stt-credential-change')
    const reference = `omlx-settings:${CANARY}`
    type('stt-credential-input', reference)
    script(created)
    press('stt-save')
    await waitFor(() => expect(requests('updateSttConfig')).toHaveLength(1))
    // Negative control: the search finds the canary where it must be — in the one request body.
    expect(JSON.stringify(requests('updateSttConfig')[0]!.body)).toContain(CANARY)
    await waitFor(() => expect(screen.queryByTestId('stt-credential-input')).toBeNull())
    await created.flush()
    expect(reported()).not.toContain('CANARY')
    // Retyping is needed: opening the field again finds it empty.
    if (!disabled('stt-credential-change')) {
      press('stt-credential-change')
      expect(input('stt-credential-input').value).toBe('')
    }
    expect(requests('updateSttConfig')).toHaveLength(1)
  })

  it('negative control: `reported()` sees a value that a record carries under a plain name', async () => {
    await mountItem()
    await openItem()
    webErrorSink.report({ level: 'warn', source: 'test', message: 'control', at: 0, context: { note: `plain ${CANARY}` } })
    expect(reported()).toContain('CANARY')
  })

  it('503 CREDENTIAL_STORE_NOT_READY is said plainly, not as "the Core server is starting"', async () => {
    const created = await mountItem()
    await openItem()
    press('stt-credential-change')
    type('stt-credential-input', 'omlx-settings:auth.api_key')
    failures[4]![1](created)
    press('stt-save')
    expect(await screen.findByTestId('stt-credential-store-not-ready')).toHaveTextContent(T.credentialStoreNotReady)
    expect(toastTexts()).toEqual([])
  })
})

describe('test connection (operation 92)', () => {
  const notReady = { status: 503, body: { error: { code: 'NOT_READY', message: 'No transcriber probe can run.', details: { reason: 'TRANSCRIBER_NOT_READY' } } } }

  it('503 TRANSCRIBER_NOT_READY: an inline notice, no toast', async () => {
    const created = await mountItem()
    await openItem()
    expect(screen.getByTestId('stt-last-test')).toHaveTextContent(T.lastTestNone)
    created.fake.answerOnce('testSttConnection', notReady)
    press('stt-test')
    expect(await screen.findByTestId('stt-test-not-ready')).toHaveTextContent(T.testNotReady)
    expect(requests('testSttConnection')).toHaveLength(1)
    expect(requests('testSttConnection')[0]!.body ?? null).toBeNull()
    expect(toastTexts()).toEqual([])
  })

  it('`reachable: false` is an inline result ("Not reachable"), not an error toast; a reachable answer says so', async () => {
    const created = await mountItem()
    await openItem()
    created.fake.answerOnceFromExample('testSttConnection', 200, 'unreachable')
    press('stt-test')
    expect(await screen.findByTestId('stt-test-result')).toHaveTextContent(T.testResult.unreachable)
    expect(screen.getByTestId('stt-test-detail')).toHaveTextContent(T.testDetail.UNREACHABLE)
    expect(toastTexts()).toEqual([])
    created.fake.answerOnceFromExample('testSttConnection', 200, 'reachable')
    press('stt-test')
    await waitFor(() => expect(screen.getByTestId('stt-test-result')).toHaveTextContent(T.testResult.reachable))
  })

  it('disabled while the form differs from the stored configuration (the test runs on the stored one)', async () => {
    const created = await mountItem()
    await openItem()
    fireEvent.click(switchInput('stt-diarization'))
    expect(disabled('stt-test')).toBe(true)
    expect(screen.getByTestId('stt-test-hint')).toHaveTextContent(T.testUnsaved)
    press('stt-test')
    await created.flush()
    expect(requests('testSttConnection')).toHaveLength(0)
  })
})

describe('a failed read', () => {
  it('an outage of operation 90: the load error with Retry, both gated controls stay disabled', async () => {
    await mountItem(SUPERVISOR_SESSION, (b) => b.fake.failOnce('getSttConfig'))
    toggleItem()
    expect(await screen.findByTestId('stt-load-error')).toHaveTextContent(T.loadFailed)
    expect(disabled('stt-save')).toBe(true)
    expect(disabled('stt-test')).toBe(true)
    expect(screen.getByTestId('stt-load-retry')).toBeInTheDocument()
  })
})

describe('Simulated mode', () => {
  it('a one-line note; no field, no control', () => {
    const sim = createSim({ clock: createManualClock(1_760_000_000_000) })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SimProvider sim={sim} autoStart={false}>
          <I18nextProvider i18n={i18n}>
            <MotionPolicyProvider>
              <Accordion>
                <SttSettingsItem />
              </Accordion>
            </MotionPolicyProvider>
          </I18nextProvider>
        </SimProvider>
      </QueryClientProvider>,
    )
    toggleItem()
    expect(screen.getByTestId('stt-live-only')).toHaveTextContent(T.liveOnly)
    expect(screen.queryByTestId('stt-save')).toBeNull()
  })
})

describe('static rules', () => {
  const SRC = resolve(__dirname, '..')
  const files = ['features/system/stt-config-section.tsx', 'features/system/stt-config-model.ts', 'features/system/stt-config-queries.ts'].map((file) => [file, readFileSync(resolve(SRC, file), 'utf8')] as const)

  it.each(files)('%s: no console, no web storage, no mutation cache, no sink but the page reporter', (_file, text) => {
    const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    expect(code).not.toMatch(/\bconsole\s*\./)
    expect(code).not.toMatch(/\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/)
    expect(code).not.toMatch(/\buseMutation\b/)
    expect(code).not.toMatch(/webErrorSink|\.report\(/)
    expect(code).not.toMatch(/defaultValue/)
  })

  it('the section logs through `logSystemError` only (the page reporter → the sink of `@dems/shared/redaction`), and never passes the draft', () => {
    const code = files[0]![1]
    const calls = code.match(/logSystemError\([^\n]*/g) ?? []
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call).not.toMatch(/credential\b(?!')|values|body|draft|\.text/)
    expect(readFileSync(resolve(SRC, 'runtime/error-sink.ts'), 'utf8')).toMatch(/from '@dems\/shared\/redaction'/)
  })

  it('operation 91 stays on the Try-it deny list', () => {
    expect(readFileSync(resolve(SRC, 'features/api-reference/try-it.ts'), 'utf8')).toMatch(/'updateSttConfig',/)
  })

  it('the key is a Core key, so the query bridge removes it at a session end', () => {
    expect(STT_CONFIG_QUERY_KEY).toEqual(['core', 'stt-config'])
  })
})
