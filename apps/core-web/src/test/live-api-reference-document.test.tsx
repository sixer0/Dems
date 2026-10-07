/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Plan row W84: the API Reference page in both modes, the parts that need no page (backend task
// 04_client_integration_spec §11, §13.11). The page itself, in Live mode on the fake transport and in
// Simulated mode on the simulator, is `live-api-reference-page.test.tsx`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | AR-1, AC-C-100 Simulated: the ten operations as before; "Show Core-server endpoints" lists 75 (66 without the simulated ones), the 65 with CORE SERVER | "AR-2: the Simulated views" |
// | AR-2, AC-C-100 Simulated: Try-it of a Core-server operation is rejected without a request, and without asking the simulator; the ten route as before | "AR-2: Try-it in Simulated mode" |
// | AR-3, AC-C-100 Live: 75 operations, every one LIVE, served from the page origin only | "AR-3: the Live document" |
// | AR-5 Live examples take the session and evidence identifiers from the replica | "AR-5" |
// | AR-3, AC-C-100 Live Try-it: `{page origin}/api/v1/*` to the network with the cookie, never the simulator; a URL outside it rejected | "AR-3: Try-it in Live mode" |
// | AR-3a, AC-C-103 the six operations rejected before a request, also when spelled otherwise | "AR-3a" |
// | AR-9, AC-C-103, AC-C-107 the page's log holds method, path and status only; no marker password, pairing code or bearer value | "AR-9" |
// | AR-7 the Realtime panel's Live entries: by type, no payload, meters as a rate | "AR-7: the Live frame tap" |
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CORE_API_OPERATIONS,
  CORE_HTTP_ORIGIN,
  CORE_SERVER_HTTP_ORIGIN,
  CORE_SERVER_WS_URL,
  isOfflineCoreApiOperation,
  listOpenApiOperations,
  REPLICATED_SLICE_NAMES,
  serializeOpenApiDocument,
  type OpenApiDocument,
} from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { HeartbeatState } from '@dems/shared/domain'
import type { HeartbeatSnapshot, LiveSocketCounters } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import {
  apiDocumentJson,
  apiDocumentJsonFor,
  buildApiDocument,
  buildApiDocumentFor,
  buildLiveApiDocument,
  CORE_SERVER_BADGE,
  countOperations,
  NO_REPLICA_IDENTIFIERS,
  replicaIdentifiersOf,
} from '@/features/api-reference/api-document'
import { createSimAwareFetch, type FetchLike, type TryItExchange } from '@/features/api-reference/sim-fetch'
import {
  BlockedRequestError,
  CORE_SERVER_ONLY_OPERATIONS,
  createLiveTryItFetch,
  deniedTryItOperation,
  TRY_IT_DENIED_OPERATIONS,
  TryItRefusedError,
} from '@/features/api-reference/try-it'
import { createLiveFrameTap, useLiveRealtimeFeed, type LiveFrameReading } from '@/features/api-reference/use-live-realtime-feed'
import { setCoreEndpointMode } from '@/lib/core-endpoint'
import { webErrorSink } from '@/runtime'

const PAGE = 'http://127.0.0.1:5178'
const SECRET = en.apiReference.tryIt.secretDenied
const CORE_ONLY = en.apiReference.tryIt.coreServerOnly
/** Markers of AC-C-107: none of them may reach the page's log. */
const MARKER_PASSWORD = 'W84-marker-password-7f3c'
const MARKER_CODE = '482913'
const MARKER_BEARERS = ['ses_W84markerSessionToken000000000000', 'dvc_W84markerDeviceCredential0000000', 'bio_W84markerBiometricToken00000000']

const sims: Sim[] = []

beforeEach(() => {
  webErrorSink.clear()
})

afterEach(() => {
  for (const sim of sims.splice(0)) sim.destroy()
  setCoreEndpointMode('SIMULATED')
  vi.restoreAllMocks()
})

async function makeSim(): Promise<Sim> {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: Date.parse('2026-10-01T03:00:00Z') })
  const sim = createSim({
    clock: createManualClock(Date.parse('2026-10-01T03:00:00Z')),
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
  sims.push(sim)
  await sim.ready
  return sim
}

/** Every `$ref` of a document resolves inside it. */
function unresolvedRefs(document: OpenApiDocument): string[] {
  const text = JSON.stringify(document)
  const missing = new Set<string>()
  for (const match of text.matchAll(/"\$ref":"#\/components\/(\w+)\/([^"]+)"/g)) {
    const [, section = '', name = ''] = match
    const table = (document.components as unknown as Record<string, Record<string, unknown> | undefined>)[section]
    if (!table || !(name in table)) missing.add(`${section}/${name}`)
  }
  return [...missing]
}

const badgesOf = (document: OpenApiDocument) =>
  listOpenApiOperations(document).map(({ operation }) => [operation.operationId, operation['x-badges'].map((badge) => badge.name)] as const)

const pathOf = (operationId: string, id = 'X-1'): string => {
  const operation = CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId)
  if (!operation) throw new Error(operationId)
  return operation.path.replace('{id}', id)
}
const methodOf = (operationId: string): string => CORE_API_OPERATIONS.find((candidate) => candidate.operationId === operationId)?.method.toUpperCase() ?? 'GET'

/** What every record of the page's own log may hold in its context: the request's method, path, status, and the reporter's own facts. */
const ALLOWED_CONTEXT = new Set(['method', 'path', 'status', 'errorName', 'code', 'correlationId'])

function assertLogDiscipline(): void {
  const records = webErrorSink.records().filter((record) => record.source.startsWith('ApiReference.'))
  for (const record of records) {
    expect(record.stack, record.source).toBeUndefined()
    for (const key of Object.keys(record.context ?? {})) expect(ALLOWED_CONTEXT.has(key), `${record.source}: ${key}`).toBe(true)
    expect(String(record.context?.correlationId)).toMatch(/^api-/)
  }
  const text = JSON.stringify(webErrorSink.records())
  for (const marker of [MARKER_PASSWORD, MARKER_CODE, ...MARKER_BEARERS, 'ses_', 'dvc_', 'bio_']) expect(text, marker).not.toContain(marker)
}

describe('AR-2: the Simulated views (AC-C-100)', () => {
  it('the default view is the document of before: ten operations, byte-equal to `buildApiDocument(true)`', () => {
    const view = buildApiDocumentFor({ mode: 'simulated', includeSimulated: true, includeCoreServer: false })
    expect(countOperations(view)).toBe(10)
    expect(serializeOpenApiDocument(view)).toBe(serializeOpenApiDocument(buildApiDocument(true)))
    expect(apiDocumentJsonFor({ mode: 'simulated', includeSimulated: true, includeCoreServer: false })).toBe(apiDocumentJson(true))
    expect(apiDocumentJsonFor({ mode: 'simulated', includeSimulated: false, includeCoreServer: false })).toBe(apiDocumentJson(false))
  })

  it('"Show Core-server endpoints" lists 75: the ten unchanged, the other 65 with CORE SERVER in place of LIVE', () => {
    const plain = buildApiDocument(true)
    const view = buildApiDocumentFor({ mode: 'simulated', includeSimulated: true, includeCoreServer: true })
    expect(countOperations(view)).toBe(75)
    expect(CORE_SERVER_ONLY_OPERATIONS).toHaveLength(65)
    const coreOnly = new Set(CORE_SERVER_ONLY_OPERATIONS.map((operation) => operation.operationId))
    for (const [operationId, badges] of badgesOf(view)) {
      if (coreOnly.has(operationId)) {
        expect(badges[0], operationId).toBe(CORE_SERVER_BADGE.name)
        expect(badges, operationId).not.toContain('LIVE')
      }
    }
    // The ten, `info`, `servers` and the offline texts are those of the plain view.
    for (const { path, method, operation } of listOpenApiOperations(plain)) {
      expect(view.paths[path]?.[method], operation.operationId).toEqual(operation)
    }
    expect(view.info).toEqual(plain.info)
    expect(view.servers).toEqual(plain.servers)
    for (const tag of plain.tags) expect(view.tags.find((candidate) => candidate.name === tag.name)).toEqual(tag)
    expect(view.components.headers).toHaveProperty('XDemsSimulated')
    expect(unresolvedRefs(view)).toEqual([])
    expect(CORE_SERVER_BADGE.color).toMatch(/^#/)
  })

  it('with "Show simulated endpoints" off as well: health and the 65 (66)', () => {
    const view = buildApiDocumentFor({ mode: 'simulated', includeSimulated: false, includeCoreServer: true })
    expect(countOperations(view)).toBe(66)
    expect(badgesOf(view).filter(([, badges]) => badges.includes('SIMULATED'))).toEqual([])
    expect(unresolvedRefs(view)).toEqual([])
  })
})

describe('AR-2: Try-it in Simulated mode (AC-C-100)', () => {
  async function harness(coreServerRefusal?: string) {
    const sim = await makeSim()
    const request = vi.spyOn(sim, 'request')
    const networkFetch = vi.fn<FetchLike>(async () => new Response('{}', { status: 200 }))
    const exchanges: TryItExchange[] = []
    const fetch = createSimAwareFetch({ sim, networkFetch, onExchange: (exchange) => exchanges.push(exchange), ...(coreServerRefusal ? { coreServerRefusal } : {}) })
    return { sim, request, networkFetch, exchanges, fetch }
  }

  it.each(CORE_SERVER_ONLY_OPERATIONS.map((operation) => [operation.operationId] as const))(
    '%s is rejected with the sentence of AR-2: no request, no simulator answer',
    async (operationId) => {
      const { request, networkFetch, exchanges, fetch } = await harness(CORE_ONLY)
      const method = methodOf(operationId)
      const call = fetch(new Request(`${CORE_HTTP_ORIGIN}${pathOf(operationId)}`, method === 'POST' ? { method, body: '{}', headers: { 'content-type': 'application/json' } } : { method }))
      await expect(call).rejects.toBeInstanceOf(TryItRefusedError)
      await expect(call).rejects.toMatchObject({ message: CORE_ONLY, reason: 'CORE_SERVER' })
      expect(request).not.toHaveBeenCalled()
      expect(networkFetch).not.toHaveBeenCalled()
      expect(exchanges).toEqual([])
    },
  )

  it('the ten route as before with the switch on: health to the network, the nine to the simulator', async () => {
    const { request, networkFetch, fetch } = await harness(CORE_ONLY)
    await fetch(`${CORE_HTTP_ORIGIN}/api/v1/health`)
    expect(networkFetch).toHaveBeenCalledTimes(1)
    for (const operation of CORE_API_OPERATIONS.filter(isOfflineCoreApiOperation).filter((candidate) => candidate.operationId !== 'getServiceHealth')) {
      const response = await fetch(new Request(`${CORE_HTTP_ORIGIN}${operation.path.replace('{id}', 'SES-20261001-0001')}`, { method: operation.method.toUpperCase(), ...(operation.method === 'post' ? { body: '{}' } : {}) }))
      expect(response.headers.get('x-dems-simulated'), operation.operationId).toBe('1')
    }
    expect(request).toHaveBeenCalledTimes(9)
  })

  it('without the switch nothing changes: a Core-server path is the simulator\'s answer, as before', async () => {
    const { request, fetch } = await harness()
    const response = await fetch(`${CORE_HTTP_ORIGIN}/api/v1/auth/session`)
    expect(request).toHaveBeenCalledTimes(1)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it('the refusal is written to the page\'s log with the method and the path only (AR-9)', async () => {
    const { fetch } = await harness(CORE_ONLY)
    await expect(fetch(new Request(`${CORE_HTTP_ORIGIN}/api/v1/auth/sign-in`, { method: 'POST', body: JSON.stringify({ username: 'andi.pratama', password: MARKER_PASSWORD }) }))).rejects.toBeInstanceOf(TryItRefusedError)
    const records = webErrorSink.records()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      level: 'warn',
      source: 'ApiReference.simAwareFetch.coreServer',
      message: 'A Try-it request of a Core-server operation was refused in Simulated mode.',
      context: { method: 'POST', path: '/api/v1/auth/sign-in', errorName: 'TryItRefusedError' },
    })
    assertLogDiscipline()
  })
})

describe('AR-3: the Live document (AC-C-100)', () => {
  beforeEach(() => setCoreEndpointMode('LIVE'))

  it('75 operations, every one LIVE, served from the page\'s own origin and from nowhere else', () => {
    const document = buildLiveApiDocument(NO_REPLICA_IDENTIFIERS)
    expect(countOperations(document)).toBe(75)
    for (const [operationId, badges] of badgesOf(document)) expect(badges[0], operationId).toBe('LIVE')
    expect(document.servers.map((server) => server.url)).toEqual([PAGE])
    expect(document.info.version).toBe('0.2.1')
    const prose = [document.info.description, ...document.tags.map((tag) => tag.description)].join('\n')
    expect(prose).not.toContain(`\`${CORE_SERVER_HTTP_ORIGIN}\``)
    expect(prose).not.toContain(`\`${CORE_SERVER_WS_URL}\``)
    expect(prose).toContain(`\`${PAGE}\``)
    expect(prose).toContain('`ws://127.0.0.1:5178/ws`')
    expect(unresolvedRefs(document)).toEqual([])
    // The view function gives the same document, and the Download text is its serialisation (AR-8).
    const view = { mode: 'live', identifiers: NO_REPLICA_IDENTIFIERS } as const
    expect(apiDocumentJsonFor(view)).toBe(serializeOpenApiDocument(buildApiDocumentFor(view)))
  })
})

describe('AR-5: Live examples take their identifiers from the replica', () => {
  beforeEach(() => setCoreEndpointMode('LIVE'))

  const examplesOf = (document: OpenApiDocument) =>
    Object.fromEntries(
      listOpenApiOperations(document).flatMap(({ operation }) =>
        (operation.parameters ?? []).filter((parameter) => parameter.in === 'path').map((parameter) => [operation.operationId, parameter.example] as const),
      ),
    )

  it('the open session, the last sealed session for the summary, the first sealed evidence item', () => {
    const ids = replicaIdentifiersOf({
      session: { id: 'SES-20261006-0031' },
      lastSealedSessionId: 'SES-20261006-0030',
      evidence: [
        { id: 'EV-20261006-0009', sealedAt: null },
        { id: 'EV-20261006-0010', sealedAt: 1 },
      ],
    })
    expect(ids).toEqual({ openSessionId: 'SES-20261006-0031', lastSealedSessionId: 'SES-20261006-0030', firstSealedEvidenceId: 'EV-20261006-0010' })
    const examples = examplesOf(buildLiveApiDocument(ids))
    expect(examples.startSession).toBe('SES-20261006-0031')
    expect(examples.addSessionNote).toBe('SES-20261006-0031')
    expect(examples.acknowledgeSessionSummary).toBe('SES-20261006-0030')
    expect(examples.exportEvidence).toBe('EV-20261006-0010')
    expect(examples.getEvidence).toBe('EV-20261006-0010')
    // Seeded identifiers stay as the contract gives them.
    expect(examples.assignUserRole).toBe('OPR-003')
    const text = JSON.stringify(examples)
    expect(text).not.toContain('SES-20261001-0024')
    expect(text).not.toContain('EV-20260930-0004')
  })

  it('without a session or a sealed item the example is removed, never a frozen one', () => {
    const examples = examplesOf(buildLiveApiDocument(NO_REPLICA_IDENTIFIERS))
    for (const operationId of ['startSession', 'stopSession', 'addSessionNote', 'acknowledgeSessionSummary', 'exportEvidence', 'verifyEvidence']) {
      expect(examples[operationId], operationId).toBeUndefined()
    }
  })
})

describe('AR-3: Try-it in Live mode (AC-C-100)', () => {
  beforeEach(() => setCoreEndpointMode('LIVE'))

  function liveHarness() {
    const calls: { url: string; init: RequestInit }[] = []
    const networkFetch = vi.fn<FetchLike>(async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} })
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const exchanges: TryItExchange[] = []
    const fetch = createLiveTryItFetch({ secretRefusal: SECRET, networkFetch, onExchange: (exchange) => exchanges.push(exchange) })
    return { fetch, networkFetch, calls, exchanges }
  }

  it('a GET goes to `{page origin}/api/v1/*` with the session cookie; a POST carries its body and headers, read once', async () => {
    const { fetch, calls, exchanges } = liveHarness()
    const health = await fetch(new Request(`${PAGE}/api/v1/health`))
    expect(health.status).toBe(200)
    await fetch(HEALTH_RELATIVE)
    const body = JSON.stringify({ retentionPolicy: 'YEAR_1' })
    await fetch(new Request(`${PAGE}/api/v1/storage/policy`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }))
    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      ['GET', `${PAGE}/api/v1/health`],
      ['GET', `${PAGE}/api/v1/health`],
      ['POST', `${PAGE}/api/v1/storage/policy`],
    ])
    for (const call of calls) expect(call.init.credentials).toBe('same-origin')
    expect(calls[0]?.init.body).toBeUndefined()
    expect(calls[2]?.init.body).toBe(body)
    expect(new Headers(calls[2]?.init.headers ?? {}).get('content-type')).toBe('application/json')
    expect(exchanges).toEqual([
      { mode: 'live', method: 'GET', path: '/api/v1/health', status: 200 },
      { mode: 'live', method: 'GET', path: '/api/v1/health', status: 200 },
      { mode: 'live', method: 'POST', path: '/api/v1/storage/policy', status: 200 },
    ])
  })

  it('every one of the 69 operations that are not denied goes to the network (the nine design-book ones too)', async () => {
    const { fetch, networkFetch } = liveHarness()
    const allowed = CORE_API_OPERATIONS.filter((operation) => !(TRY_IT_DENIED_OPERATIONS as readonly string[]).includes(operation.operationId))
    expect(allowed).toHaveLength(69)
    for (const operation of allowed) {
      await fetch(new Request(`${PAGE}${operation.path.replace('{id}', 'X-1')}`, { method: operation.method.toUpperCase() }))
    }
    expect(networkFetch).toHaveBeenCalledTimes(69)
  })

  it.each([
    'https://example.com/api/v1/health',
    'http://localhost:5178/api/v1/health',
    `${CORE_SERVER_HTTP_ORIGIN}/api/v1/health`,
    `${CORE_HTTP_ORIGIN}/api/v1/health`,
    `${PAGE}/ws`,
    `${PAGE}/openapi.json`,
    `${PAGE}/api/v10/health`,
    'https://proxy.scalar.com/?scalar_url=http%3A%2F%2F127.0.0.1%3A5178%2Fapi%2Fv1%2Fhealth',
  ])('a URL outside `{page origin}/api/v1` is rejected without a request: %s', async (url) => {
    const { fetch, networkFetch } = liveHarness()
    await expect(fetch(url)).rejects.toBeInstanceOf(BlockedRequestError)
    await expect(fetch(url)).rejects.toThrow(`(${PAGE}/api/v1)`)
    expect(networkFetch).not.toHaveBeenCalled()
  })

  it('a network failure is written to the log by method and path, and passed on; a cancel is not logged', async () => {
    const failing = createLiveTryItFetch({
      secretRefusal: SECRET,
      networkFetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await expect(failing(`${PAGE}/api/v1/health`)).rejects.toThrow('Failed to fetch')
    const aborting = createLiveTryItFetch({
      secretRefusal: SECRET,
      networkFetch: async () => {
        throw new DOMException('The operation was aborted.', 'AbortError')
      },
    })
    await expect(aborting(`${PAGE}/api/v1/health`)).rejects.toThrow('aborted')
    expect(webErrorSink.records().map((record) => [record.source, record.message, record.context?.method, record.context?.path, record.context?.errorName])).toEqual([
      ['ApiReference.liveTryIt.network', 'A Try-it request did not reach the Core server.', 'GET', '/api/v1/health', 'TypeError'],
    ])
    assertLogDiscipline()
  })
})

const HEALTH_RELATIVE = '/api/v1/health'

describe('AR-3a: the six operations are rejected before a request (AC-C-103)', () => {
  beforeEach(() => setCoreEndpointMode('LIVE'))

  /** A body that carries every marker of AC-C-107. */
  const markedBody = JSON.stringify({ username: 'andi.pratama', password: MARKER_PASSWORD, code: MARKER_CODE, token: MARKER_BEARERS[2], credential: MARKER_BEARERS[1], session: MARKER_BEARERS[0] })

  it.each(TRY_IT_DENIED_OPERATIONS.map((operationId) => [operationId] as const))('%s: the sentence of AR-3a, no request', async (operationId) => {
    const networkFetch = vi.fn<FetchLike>(async () => new Response('{}'))
    const fetch = createLiveTryItFetch({ secretRefusal: SECRET, networkFetch })
    const call = fetch(new Request(`${PAGE}${pathOf(operationId)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: markedBody }))
    await expect(call).rejects.toBeInstanceOf(TryItRefusedError)
    await expect(call).rejects.toMatchObject({ message: SECRET, reason: 'SECRET', method: 'POST', path: pathOf(operationId) })
    expect(networkFetch).not.toHaveBeenCalled()
    expect(webErrorSink.records().at(-1)).toMatchObject({ source: 'ApiReference.liveTryIt.denied', context: { method: 'POST', path: pathOf(operationId) } })
    assertLogDiscipline()
  })

  it.each([
    ['POST', '/api/v1/auth/sign-in/'],
    ['POST', '/api/v1/AUTH/Sign-In'],
    ['POST', '/api/v1//auth/sign-in'],
    ['POST', '/api/v1/auth%2Fsign-in'],
    ['POST', '/api/v1/auth/sign%2Din'],
    ['POST', '/api/v1/pairing/code/'],
    ['POST', '/api/v1/Pairing/Redeem'],
    ['POST', '/api/v1/pairing/device/credential//'],
    ['PUT', '/api/v1/auth/biometric/sign-in'],
    ['GET', '/api/v1/auth/biometric'],
  ])('another spelling of a denied operation is refused too: %s %s', (method, path) => {
    expect(deniedTryItOperation(method, path)).not.toBeNull()
  })

  it.each([
    ['GET', '/api/v1/pairing/code', 'getPairingCodeStatus reads the status, never the code'],
    ['GET', '/api/v1/Pairing/Code/', 'getPairingCodeStatus spelled otherwise: still not the denied POST of the same path'],
    ['POST', '/api/v1/pairing/code/cancel', 'cancelPairingCode'],
    ['POST', '/api/v1/auth/sign-out', 'signOut'],
    ['POST', '/api/v1/auth/biometric/failure', 'reportBiometricFailure'],
    ['GET', '/api/v1/pairing/device', 'getDeviceRegistration'],
  ])('an operation beside them stays allowed: %s %s (%s)', (method, path) => {
    expect(deniedTryItOperation(method, path)).toBeNull()
  })
})

describe('AR-7: the Live frame tap (no payload, by type, meters as a rate)', () => {
  const counters = (over: Partial<LiveSocketCounters> = {}): LiveSocketCounters => ({
    received: 0, invalid: 0, snapshots: 1, deltas: 0, deltasDropped: 0, deltasStale: 0, meters: 0, metersDropped: 0, control: 0, sent: 0, resyncs: 0, reconnects: 0, errors: 0, ...over,
  })
  const beat = (seq: number | null, at: number | null): HeartbeatSnapshot => ({
    state: HeartbeatState.LIVE, seq, serverTime: seq === null ? null : `2026-10-06T00:00:0${seq % 10}.000Z`, lastBeatAt: at, clients: 1, reconnectAttempt: 0,
  })
  const replica = (over: Record<string, unknown> = {}): Record<string, unknown> => {
    const base: Record<string, unknown> = {}
    for (const name of REPLICATED_SLICE_NAMES) base[name] = { name }
    return { ...base, ...over }
  }

  it('starts from the reading at mount, then lists heartbeats, a snapshot and deltas newest first, at most five', () => {
    const tap = createLiveFrameTap()
    const state0 = replica()
    const reading = (over: Partial<LiveFrameReading>): LiveFrameReading => ({ heartbeat: beat(1, 1_000), status: { epoch: 3, revision: 40, counters: counters() }, replica: state0, ...over })
    expect(tap.observe(reading({}))).toBe(false)
    expect(tap.getEntries()).toEqual([])
    expect(tap.observe(reading({ heartbeat: beat(2, 2_000) }))).toBe(true)
    const secret = { caseNumber: 'LP/2026/1006-0001', subjectName: 'Synthetic Subject' }
    const state1 = { ...state0, session: secret, sessionHistory: [secret] }
    tap.observe(reading({ heartbeat: beat(2, 2_000), status: { epoch: 3, revision: 42, counters: counters({ deltas: 2 }) }, replica: state1 }))
    const state2 = replica()
    tap.observe(reading({ heartbeat: beat(2, 2_000), status: { epoch: 4, revision: 0, counters: counters({ snapshots: 2, deltas: 2 }) }, replica: state2 }))
    const entries = tap.getEntries()
    expect(entries.map((entry) => entry.type)).toEqual(['snapshot', 'delta', 'heartbeat'])
    expect(JSON.parse(entries[0]?.text ?? '')).toEqual({ type: 'snapshot', epoch: 4, revision: 0, slices: [...REPLICATED_SLICE_NAMES] })
    expect(JSON.parse(entries[1]?.text ?? '')).toEqual({ type: 'delta', epoch: 3, revision: 42, slices: ['session', 'sessionHistory'], deltas: 2 })
    expect(JSON.parse(entries[2]?.text ?? '')).toEqual({ type: 'heartbeat', seq: 2, serverTime: '2026-10-06T00:00:02.000Z', clients: 1 })
    // Never a state payload.
    const text = entries.map((entry) => entry.text).join('\n')
    expect(text).not.toContain('LP/2026/1006-0001')
    expect(text).not.toContain('Synthetic Subject')
    for (let seq = 3; seq < 10; seq += 1) tap.observe(reading({ heartbeat: beat(seq, seq * 1_000), status: { epoch: 4, revision: 0, counters: counters({ snapshots: 2, deltas: 2 }) }, replica: state2 }))
    expect(tap.getEntries()).toHaveLength(5)
    expect(tap.getEntries().every((entry) => entry.type === 'heartbeat')).toBe(true)
  })

  it('a client-only change of the replica (the clock, the audio) is no entry; meter frames are a rate, never an entry', () => {
    const tap = createLiveFrameTap()
    const state0 = replica()
    tap.observe({ heartbeat: beat(1, 1_000), status: { epoch: 3, revision: 40, counters: counters() }, replica: { ...state0, clock: 1 } })
    tap.observe({ heartbeat: beat(1, 1_000), status: { epoch: 3, revision: 40, counters: counters({ meters: 5 }) }, replica: { ...state0, clock: 2, audio: { level: 0.9 } } })
    expect(tap.getEntries()).toEqual([])
    expect(tap.getMetersRate()).toBeNull()
    tap.observe({ heartbeat: beat(2, 2_000), status: { epoch: 3, revision: 40, counters: counters({ meters: 10 }) }, replica: state0 })
    expect(tap.getMetersRate()).toBe(10)
    tap.observe({ heartbeat: beat(3, 3_000), status: { epoch: 3, revision: 40, counters: counters({ meters: 30 }) }, replica: state0 })
    expect(tap.getMetersRate()).toBe(15)
    expect(tap.getEntries().map((entry) => entry.type)).toEqual(['heartbeat', 'heartbeat'])
  })

  it('FXR-W W92-26: the epoch and revision are kept from each reading, the same object until one changes, and a change alone notifies', () => {
    const tap = createLiveFrameTap()
    const state0 = replica()
    const heard = vi.fn()
    tap.subscribe(heard)
    tap.observe({ heartbeat: beat(1, 1_000), status: { epoch: 3, revision: 40, counters: counters() }, replica: state0 })
    const first = tap.getPosition()
    expect(first).toEqual({ epoch: 3, revision: 40 })
    // The same reading again: the same object, nobody told.
    heard.mockClear()
    tap.observe({ heartbeat: beat(1, 1_000), status: { epoch: 3, revision: 40, counters: counters() }, replica: state0 })
    expect(tap.getPosition()).toBe(first)
    expect(heard).not.toHaveBeenCalled()
    // The revision moves with no entry (a delta of a client-only slice): the position follows and the listeners hear it.
    expect(tap.observe({ heartbeat: beat(1, 1_000), status: { epoch: 3, revision: 41, counters: counters({ deltas: 1 }) }, replica: state0 })).toBe(false)
    expect(tap.getEntries()).toEqual([])
    expect(tap.getPosition()).toEqual({ epoch: 3, revision: 41 })
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('FXR-W W92-26: the panel\'s feed shows a new revision without waiting for an entry (no read of the source during render)', async () => {
    const state0 = replica()
    let status = { epoch: 3, revision: 40, counters: counters() }
    const storeListeners = new Set<() => void>()
    const heartbeatSnapshot = beat(1, 1_000)
    const live = {
      heartbeat: { subscribe: () => () => undefined, getSnapshot: () => heartbeatSnapshot },
      socketStatus: () => status,
      store: {
        getState: () => state0,
        subscribe: (listener: () => void) => {
          storeListeners.add(listener)
          return () => storeListeners.delete(listener)
        },
      },
    }
    const { result } = renderHook(() => useLiveRealtimeFeed(live as never))
    expect(result.current).toMatchObject({ epoch: 3, revision: 40 })
    status = { epoch: 3, revision: 44, counters: counters({ deltas: 4 }) }
    act(() => {
      for (const listener of storeListeners) listener()
    })
    expect(result.current).toMatchObject({ epoch: 3, revision: 44 })
  })
})
