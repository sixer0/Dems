/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W84: the API Reference page `/developer/api` in both modes (backend task
// 04_client_integration_spec §11, §13.11). Live mode runs on W50's harness: the real router and Live
// start-up on the contract-checked fake transport, rendered under StrictMode as `main.tsx` does.
// Simulated mode runs on the simulator, as the protected route tests do. Scalar is replaced by a stub
// that records the configuration the page hands it, so a test calls Try-it exactly as Scalar does:
// `configuration.customFetch(request)`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AC-C-100 Live: 97 operations, all `LIVE`, the page origin as the one server; a Try-it of `getServiceHealth` answered by `dems-core-server`; a URL outside `{page origin}/api/v1` rejected | "Live mode: the document and Try-it" |
// | AC-C-103 Live: Try-it of the ten operations (six of 01_specs §7.7, ops 89, 91, 95 and 96 of task 3) sends no request (the fake transport's log); after one GET and one POST no web-storage value holds a request body or an answer; the page's log holds method, path and status only | "AC-C-103" |
// | AC-C-107 no marker password, no pairing code, no `ses_`/`dvc_`/`bio_` value in the error sink or the page's log | "AC-C-103" (the marked bodies) |
// | AC-C-18 with the page open, no second socket: one connection, the global `WebSocket` never constructed; the Realtime panel lists the one socket's messages by type, prints no payload and has no Connect switch | "AC-C-18" |
// | AR-4, AR-6 the warning names the signed-in operator; the banner names `dems-core-server`, its version and its readiness | "Live mode: the document and Try-it" |
// | AC-C-100 Simulated: ten operations as before; "Show Core-server endpoints" lists 75 and a Try-it of a Core-server operation is rejected without a request | "Simulated mode" |
import { createElement } from 'react'
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_API_OPERATIONS, listOpenApiOperations, type OpenApiDocument } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import type { DemsScalarConfiguration } from '@/features/api-reference/scalar-config'
import { TRY_IT_DENIED_OPERATIONS, TryItRefusedError } from '@/features/api-reference/try-it'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { setCoreEndpointMode } from '@/lib/core-endpoint'
import { createAppRouter } from '@/router'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, LIVE_TEST_ORIGIN, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

// Scalar replaced by a stub that keeps the configuration (the renderer module is the only runtime import of Scalar).
const scalar = vi.hoisted(() => ({ configurations: [] as unknown[] }))
vi.mock('@/features/api-reference/scalar-renderer', () => ({
  default: ({ configuration }: { configuration: unknown }) => {
    scalar.configurations.push(configuration)
    return createElement('div', { 'data-testid': 'scalar-stub' })
  },
}))

const A = en.apiReference
const MARKER_PASSWORD = 'W84-page-marker-password-91d2'
const MARKER_CODE = '771234'
const MARKER_BEARERS = ['ses_W84pageMarkerSessionToken0000000000', 'dvc_W84pageMarkerDeviceCredential00000', 'bio_W84pageMarkerBiometricToken000000']

/** The configuration Scalar got last. */
function lastConfiguration(): DemsScalarConfiguration {
  const configuration = scalar.configurations.at(-1)
  if (!configuration) throw new Error('the renderer was not mounted')
  return configuration as DemsScalarConfiguration
}

// A `{id}` is given a concrete value (op 89 is on the deny list since task 3 row 113, fix round 1): a request carries a path, not a template.
const pathOf = (operationId: string): string => (CORE_API_OPERATIONS.find((operation) => operation.operationId === operationId)?.path ?? '').replace('{id}', 'CAM-01')
const badgesOf = (document: OpenApiDocument) => listOpenApiOperations(document).map(({ operation }) => operation['x-badges'][0]?.name)

/** Every value of every web storage the page can reach. */
function storageText(bed?: LiveTestBed): string {
  const values: string[] = []
  for (const storage of [window.localStorage, window.sessionStorage, ...(bed?.storage ? [bed.storage] : [])]) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key !== null) values.push(`${key}=${storage.getItem(key) ?? ''}`)
    }
  }
  return values.join('\n')
}

/** Every socket opened with the global constructor. */
let globalSockets: string[] = []
class CountingSocket {
  readyState = 0
  onopen: unknown = null
  onmessage: unknown = null
  onclose: unknown = null
  onerror: unknown = null
  constructor(url: string) {
    globalSockets.push(url)
  }
  close() {
    this.readyState = 3
  }
}

let bed: LiveTestBed | undefined
const sims: Sim[] = []

beforeEach(() => {
  scalar.configurations.length = 0
  globalSockets = []
  resetMissingI18nKeys()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  vi.stubGlobal('WebSocket', CountingSocket)
  Element.prototype.scrollTo ??= function scrollTo() {}
})

afterEach(() => {
  cleanup()
  bed?.dispose()
  bed = undefined
  for (const sim of sims.splice(0)) sim.stop()
  setCoreEndpointMode('SIMULATED')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openLive() {
  bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
  const page = await bed.load()
  const mounted = await bed.mount(page, '/developer/api', { strict: true })
  await screen.findByTestId('page-api-reference')
  await screen.findByTestId('scalar-stub')
  return { bed, page, mounted }
}

describe('Live mode: the document and Try-it (AC-C-100, AR-4, AR-6)', () => {
  it('99 operations, every one LIVE, served from the page origin; no switch; the warning names the operator', async () => {
    const { bed: live } = await openLive()
    expect(screen.getByTestId('page-api-reference')).toHaveAttribute('data-mode', 'live')
    const document = lastConfiguration().content
    expect(listOpenApiOperations(document)).toHaveLength(99) // 97 + the two sound-card operations of task 4 row 63
    expect(new Set(badgesOf(document))).toEqual(new Set(['LIVE']))
    expect(document.servers.map((server) => server.url)).toEqual([LIVE_TEST_ORIGIN])
    expect(screen.getByTestId('api-operation-count')).toHaveTextContent('99 operations')
    expect(screen.getByTestId('api-base-url')).toHaveTextContent(LIVE_TEST_ORIGIN)
    expect(screen.getByTestId('api-spec-version')).toHaveTextContent('v0.3.0')
    expect(screen.queryByTestId('api-show-simulated')).toBeNull()
    expect(screen.queryByTestId('api-show-core-server')).toBeNull()
    expect(screen.queryByTestId('api-legend-SIMULATED')).toBeNull()
    expect(screen.getByTestId('api-live-warning')).toHaveTextContent(
      A.liveWarning.body.replace('{{operator}}', SUPERVISOR_SESSION.operator.displayName),
    )
    // AR-6: the banner reads the one socket's heartbeat and the health answer.
    await live.elapse(2_000)
    await waitFor(() => expect(screen.getByTestId('api-service-banner')).toHaveTextContent('CORE SERVER ONLINE • dems-core-server v0.2.0 • READY'))
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a Try-it of `getServiceHealth` goes to the page origin with the cookie and is answered by `dems-core-server`; `sim.request` is never called', async () => {
    const { bed: live, page } = await openLive()
    const request = vi.spyOn(page.live, 'request')
    const before = live.fake.log.requestsOf('getServiceHealth').length
    const response = await lastConfiguration().customFetch(new Request(`${LIVE_TEST_ORIGIN}/api/v1/health`))
    expect(response.status).toBe(200)
    expect(((await response.json()) as { service: string }).service).toBe('dems-core-server')
    const calls = live.fake.log.requestsOf('getServiceHealth')
    expect(calls).toHaveLength(before + 1)
    expect(calls.at(-1)).toMatchObject({ url: `${LIVE_TEST_ORIGIN}/api/v1/health`, credentials: 'same-origin', outcome: 'answered' })
    expect(request).not.toHaveBeenCalled()
  })

  it('a URL outside `{page origin}/api/v1` is rejected and nothing reaches the transport', async () => {
    const { bed: live } = await openLive()
    const before = live.fake.log.requests.length
    for (const url of ['http://127.0.0.1:4420/api/v1/health', `${LIVE_TEST_ORIGIN}/ws`, 'http://localhost:5178/api/v1/health']) {
      await expect(lastConfiguration().customFetch(url)).rejects.toThrow(`(${LIVE_TEST_ORIGIN}/api/v1)`)
    }
    expect(live.fake.log.requests).toHaveLength(before)
  })
})

describe('AC-C-103 and AC-C-107: the deny list, web storage and the page\'s log', () => {
  it('Try-it of the ten operations sends no request: the fake transport\'s log holds none of them', async () => {
    const { bed: live } = await openLive()
    const before = live.fake.log.requests.length
    const marked = JSON.stringify({ username: 'andi.pratama', password: MARKER_PASSWORD, code: MARKER_CODE, token: MARKER_BEARERS[2], deviceName: MARKER_BEARERS[1], platform: MARKER_BEARERS[0] })
    for (const operationId of TRY_IT_DENIED_OPERATIONS) {
      const call = lastConfiguration().customFetch(
        new Request(`${LIVE_TEST_ORIGIN}${pathOf(operationId)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: marked }),
      )
      await expect(call, operationId).rejects.toBeInstanceOf(TryItRefusedError)
      await expect(call, operationId).rejects.toThrow(A.tryIt.secretDenied)
      expect(live.fake.log.requestsOf(operationId), operationId).toEqual([])
    }
    expect(live.fake.log.requests).toHaveLength(before)
    // Ten records, each with the method and the path only.
    const records = webErrorSink.records().filter((record) => record.source === 'ApiReference.liveTryIt.denied')
    expect(records.map((record) => record.context?.path)).toEqual(TRY_IT_DENIED_OPERATIONS.map(pathOf))
    const sink = JSON.stringify(webErrorSink.records())
    for (const marker of [MARKER_PASSWORD, MARKER_CODE, ...MARKER_BEARERS, 'ses_', 'dvc_', 'bio_']) expect(sink, marker).not.toContain(marker)
    expect(storageText(live)).not.toContain(MARKER_PASSWORD)
  })

  it('after one GET and one POST no web-storage value holds a request body or an answer; the log holds method, path and status only', async () => {
    const { bed: live } = await openLive()
    live.fake.answerFromExample('setStoragePolicy', 200)
    const { customFetch } = lastConfiguration()
    const get = await customFetch(new Request(`${LIVE_TEST_ORIGIN}/api/v1/health`))
    const getAnswer = await get.text()
    const body = JSON.stringify({ retentionPolicy: 'YEAR_1' })
    const post = await customFetch(new Request(`${LIVE_TEST_ORIGIN}/api/v1/storage/policy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }))
    expect(post.status).toBe(200)
    const postAnswer = await post.text()
    expect(live.fake.log.requestsOf('setStoragePolicy').at(-1)).toMatchObject({ bodyText: body, credentials: 'same-origin' })
    await live.flush()
    const stored = storageText(live)
    for (const text of [body, getAnswer, postAnswer, 'YEAR_1', 'dems-core-server', 'retentionPolicy']) expect(stored, text).not.toContain(text)
    // A failed exchange is the only kind the page logs; every record of the page holds method, path, status and the reporter's own facts.
    await expect(customFetch(`${LIVE_TEST_ORIGIN}/openapi.json`)).rejects.toBeInstanceOf(TypeError)
    const records = webErrorSink.records().filter((record) => record.source.startsWith('ApiReference.'))
    expect(records.length).toBeGreaterThan(0)
    for (const record of records) {
      expect(record.stack).toBeUndefined()
      for (const key of Object.keys(record.context ?? {})) expect(['method', 'path', 'status', 'errorName', 'code', 'correlationId']).toContain(key)
    }
    const sink = JSON.stringify(webErrorSink.records())
    for (const text of [body, getAnswer, postAnswer, 'YEAR_1']) expect(sink, text).not.toContain(text)
  })
})

describe('AC-C-18: no second socket with the page open in Live mode (F72-4)', () => {
  it('one connection, the Live source\'s; the global constructor is never used; the panel lists the socket\'s messages by type, no payload', async () => {
    const { bed: live, page } = await openLive()
    await live.elapse(3_000)
    expect(live.fake.connections).toHaveLength(1)
    expect(page.sockets).toHaveLength(1)
    expect(globalSockets).toEqual([])
    const panel = screen.getByTestId('api-panel-realtime')
    expect(within(panel).queryByTestId('api-realtime-connect')).toBeNull()
    expect(within(panel).getByTestId('api-realtime-url')).toHaveTextContent('ws://127.0.0.1:5178/ws')
    await waitFor(() => expect(within(panel).getByTestId('api-realtime-chip')).toHaveAttribute('data-state', 'ONLINE'))
    await waitFor(() => expect(panel.querySelectorAll('pre[data-type="heartbeat"]').length).toBeGreaterThan(0))
    const heartbeat = JSON.parse(panel.querySelector('pre[data-type="heartbeat"]')?.textContent ?? '{}') as Record<string, unknown>
    expect(Object.keys(heartbeat)).toEqual(['type', 'seq', 'serverTime', 'clients'])
    // A delta of the one socket: type, epoch, revision and the slice it touches, never its value.
    await act(async () => {
      live.fake.connection(0).delta([{ op: 'replace', slice: 'activeCameraId', value: 'VIDEO-02' }])
    })
    await live.flush()
    await waitFor(() => expect(panel.querySelectorAll('pre[data-type="delta"]').length).toBe(1))
    const delta = JSON.parse(panel.querySelector('pre[data-type="delta"]')?.textContent ?? '{}') as Record<string, unknown>
    expect(delta).toEqual({ type: 'delta', epoch: 3, revision: 41, slices: ['activeCameraId'] })
    expect(panel.textContent).not.toContain('VIDEO-02')
    expect(within(panel).getByTestId('api-realtime-revision')).toHaveTextContent('41')
    await live.elapse(2_000)
    expect(live.fake.connections).toHaveLength(1)
    expect(globalSockets).toEqual([])
  })
})

// ── Simulated mode ─────────────────────────────────────────────────────────────────────────

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

async function openSimulated() {
  const fetched: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      fetched.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    }),
  )
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.now() })
  const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  const router = createAppRouter(
    { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: ['/developer/api'] }) },
  )
  render(<RouterProvider router={router} />)
  await screen.findByTestId('page-api-reference')
  await screen.findByTestId('scalar-stub')
  return { sim, fetched }
}

describe('Simulated mode (AC-C-100, AR-2)', () => {
  it('33 operations as before; "Show Core-server endpoints" lists 99 with CORE SERVER and refuses their Try-it without a request', async () => {
    // Task 4 blueprint row 63: the two simulated sound-card operations 98-99 (31 -> 33, 97 -> 99; the 66 do not move).
    const { sim, fetched } = await openSimulated()
    expect(screen.getByTestId('page-api-reference')).toHaveAttribute('data-mode', 'simulated')
    expect(listOpenApiOperations(lastConfiguration().content)).toHaveLength(33)
    expect(screen.getByTestId('api-operation-count')).toHaveTextContent('33 operations')
    expect(screen.getByTestId('api-spec-version')).toHaveTextContent('v0.2.0')
    expect(screen.queryByTestId('api-live-warning')).toBeNull()
    expect(screen.getByTestId('api-realtime-connect')).toBeInTheDocument()
    const coreSwitch = within(screen.getByTestId('api-show-core-server')).getByRole('switch')
    expect(coreSwitch).not.toBeChecked()
    expect(screen.queryByTestId('api-legend-CORE_SERVER')).toBeNull()

    fireEvent.click(coreSwitch)
    await waitFor(() => expect(listOpenApiOperations(lastConfiguration().content)).toHaveLength(99))
    expect(screen.getByTestId('api-operation-count')).toHaveTextContent('99 operations')
    expect(screen.getByTestId('api-legend-CORE_SERVER')).toHaveTextContent(A.badges.CORE_SERVER)
    expect(badgesOf(lastConfiguration().content).filter((name) => name === 'CORE SERVER')).toHaveLength(66)

    const request = vi.spyOn(sim, 'request')
    const before = fetched.length
    await expect(lastConfiguration().customFetch(new Request('http://127.0.0.1:4400/api/v1/admin/users'))).rejects.toThrow(A.tryIt.coreServerOnly)
    await expect(
      lastConfiguration().customFetch(new Request('http://127.0.0.1:4400/api/v1/auth/sign-in', { method: 'POST', body: JSON.stringify({ username: 'andi.pratama', password: MARKER_PASSWORD }) })),
    ).rejects.toBeInstanceOf(TryItRefusedError)
    expect(request).not.toHaveBeenCalled()
    expect(fetched).toHaveLength(before)
    // The nine are still answered by the simulator.
    const current = await lastConfiguration().customFetch(new Request('http://127.0.0.1:4400/api/v1/session/current'))
    expect(current.headers.get('x-dems-simulated')).toBe('1')
    expect(request).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(webErrorSink.records())).not.toContain(MARKER_PASSWORD)

    fireEvent.click(coreSwitch)
    await waitFor(() => expect(listOpenApiOperations(lastConfiguration().content)).toHaveLength(33))
    expect(getMissingI18nKeys()).toEqual([])
  })
})
