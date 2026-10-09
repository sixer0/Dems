/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Task 3 blueprint row 117: the SECRET form of the STT credential. It is NOT offered to an operator
// before blueprint row 84 (`STT_SECRET_FORM_OFFERED` is false; `live-system-stt-config.test.tsx`
// proves the reference form is the only one on screen). This file turns the flag on for the module
// under test only, and proves the code that waits behind it:
//
// | Criterion | Where |
// |-----------|-------|
// | A password field that opens empty; choosing the form empties the field | "the form" |
// | ONE POST `credential: { kind: SECRET, value }`, the value exactly as typed | "the Core's 503" |
// | 503 CREDENTIAL_STORE_NOT_READY is worded for an operator next to the field, never as "the Core server is starting" | "the Core's 503" |
// | D70 R-3: after the refusal the value is in no sink, console call, toast, markup or cache (canary) | "the Core's 503" |
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Accordion, toast, ToastProvider } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '@dems/shared/i18n'
import { HeartbeatContext } from '@dems/shared/realtime'
import { SimProvider } from '@dems/shared/sim'
import { i18n } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { MotionPolicyProvider } from '@/motion'
import { webErrorSink } from '@/runtime'
import { applyCoreQueryDefaults } from '@/runtime/query-bridge'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'
import { SttSettingsItem } from '@/features/system/stt-config-section'

vi.mock('@/features/system/stt-config-model', async (original) => ({
  ...(await original<typeof import('@/features/system/stt-config-model')>()),
  STT_SECRET_FORM_OFFERED: true,
}))

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const T = en.system.stt
const CANARY = 'CANARY-s3cr3t-9Qx7 do not leak'

let bed: LiveTestBed | undefined
let page: LivePage | undefined
let queryClient: QueryClient | undefined
let consoleCalls: unknown[][] = []
const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
const input = () => screen.getByTestId('stt-credential-input') as HTMLInputElement

async function mountOpen(): Promise<LiveTestBed> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  created.fake.answerFromExample('getSttConfig', 200, 'seeded')
  page = await created.load()
  queryClient = new QueryClient()
  applyCoreQueryDefaults(queryClient)
  render(
    <QueryClientProvider client={queryClient}>
      <HeartbeatContext.Provider value={page.live.heartbeat}>
        <SimProvider sim={page.runtime.sim} autoStart={false}>
          <I18nextProvider i18n={i18n}>
            <MotionPolicyProvider>
              <Accordion>
                <SttSettingsItem />
              </Accordion>
              <ToastProvider />
            </MotionPolicyProvider>
          </I18nextProvider>
        </SimProvider>
      </HeartbeatContext.Provider>
    </QueryClientProvider>,
  )
  fireEvent.click(within(screen.getByTestId('system-settings-transcription')).getAllByRole('button')[0]!)
  await waitFor(() => expect(screen.getByTestId('stt-config')).toHaveAttribute('data-access', 'allowed'))
  return created
}

beforeEach(() => {
  resetCoreErrorPresenter()
  webErrorSink.clear()
  consoleCalls = []
  for (const level of ['error', 'warn', 'log', 'info', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => void consoleCalls.push(parts))
  }
})

afterEach(() => {
  cleanup()
  toast.clear()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('the SECRET form (behind STT_SECRET_FORM_OFFERED, blueprint row 84)', () => {
  it('the form: a password field that opens empty; choosing the form empties the field', async () => {
    await mountOpen()
    fireEvent.click(screen.getByTestId('stt-credential-change'))
    expect(input().type).toBe('text')
    fireEvent.change(input(), { target: { value: 'omlx-settings:typed-first' } })
    fireEvent.click(within(screen.getByTestId('stt-credential-kind')).getByRole('radio', { name: T.credentialSecret }))
    await waitFor(() => expect(input().type).toBe('password'))
    expect(input().value).toBe('')
    expect(input().getAttribute('autocomplete')).toBe('off')
  })

  it('the Core\'s 503 CREDENTIAL_STORE_NOT_READY: sent once as SECRET, said plainly, the value reported nowhere', async () => {
    const created = await mountOpen()
    fireEvent.click(screen.getByTestId('stt-credential-change'))
    fireEvent.click(within(screen.getByTestId('stt-credential-kind')).getByRole('radio', { name: T.credentialSecret }))
    await waitFor(() => expect(input().type).toBe('password'))
    fireEvent.change(input(), { target: { value: CANARY } })
    created.fake.answerOnce('updateSttConfig', {
      status: 503,
      body: { error: { code: 'NOT_READY', message: 'The Core credential store is not mounted.', details: { reason: 'CREDENTIAL_STORE_NOT_READY' } } },
    })
    fireEvent.click(screen.getByTestId('stt-save'))
    expect(await screen.findByTestId('stt-credential-store-not-ready')).toHaveTextContent(T.credentialStoreNotReady)
    const sent = created.fake.log.requestsOf('updateSttConfig')
    expect(sent).toHaveLength(1)
    expect(sent[0]!.body).toEqual({ revision: 1, credential: { kind: 'SECRET', value: CANARY } })
    expect(screen.queryByTestId('stt-credential-input')).toBeNull()
    expect(toastTexts()).toEqual([])
    await act(async () => created.flush())
    const reported = JSON.stringify({
      sink: webErrorSink.records(),
      pageSink: page!.sink.records(),
      console: consoleCalls.map((call) => call.map((part) => (part instanceof Error ? `${part.message} ${part.stack}` : part))),
      toasts: toastTexts(),
      html: document.body.innerHTML,
      cache: queryClient!.getQueryCache().getAll().map((query) => ({ state: query.state.data, error: String(query.state.error) })),
      urls: created.fake.log.urls(),
    })
    expect(reported).not.toContain('CANARY')
    expect(reported).not.toContain('s3cr3t')
    // Negative control: the same search finds it in the one place it was sent.
    expect(JSON.stringify(sent[0]!.body)).toContain('CANARY')
  })
})
