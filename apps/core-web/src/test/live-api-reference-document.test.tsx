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
// | AR-1, AC-C-100 Simulated: the ten operations as before; "Show Core-server endpoints" lists 119 (75 without the simulated ones), the 74 with CORE SERVER | "AR-2: the Simulated views" |
// | AR-2, AC-C-100 Simulated: Try-it of a Core-server operation is rejected without a request, and without asking the simulator; the ten route as before | "AR-2: Try-it in Simulated mode" |
// | AR-3, AC-C-100 Live: 119 operations, every one LIVE, served from the page origin only | "AR-3: the Live document" |
// | AR-5 Live examples take the session and evidence identifiers from the replica | "AR-5" |
// | AR-3, AC-C-100 Live Try-it: `{page origin}/api/v1/*` to the network with the cookie, never the simulator; a URL outside it rejected | "AR-3: Try-it in Live mode" |
// | AR-3a, AC-C-103 the ten operations (six of 01_specs §7.7, ops 89, 91, 95 and 96 of task 3) rejected before a request, also when spelled otherwise | "AR-3a" |
// | AR-9, AC-C-103, AC-C-107 the page's log holds method, path and status only; no marker password, pairing code or bearer value | "AR-9" |
// | AR-7 the Realtime panel's Live entries: by type, no payload, meters as a rate | "AR-7: the Live frame tap" |
//
// 2026-11-03 count sweep: the registry grew 111 -> 119 - the checkpoint f85e9c01 (the RB-9 add-user
// trio, the camera preview session, the idle-meters lease, the panel firmware read) and D57c
// 756ef424 (operations 118 getPanelSetup and 119 setPanelSetup, web-console-only, never simulated).
// All eight are Core-server-only: the simulated set stays 45, the deny list stays 14, so the
// not-denied count follows the total (97 -> 105). The counts below are pinned to that truth.
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CORE_API_OPERATIONS,
  CORE_HTTP_ORIGIN,
  CORE_SERVER_HTTP_ORIGIN,
  CORE_SERVER_WS_URL,
  CREDENTIAL_CARRYING_OPERATIONS,
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
  TRY_IT_STORED_CREDENTIAL_OPERATIONS,
  TRY_IT_STORED_RECORD_OPERATIONS,
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
  it('the default view is the document of before: 45 operations, byte-equal to `buildApiDocument(true)`', () => {
    const view = buildApiDocumentFor({ mode: 'simulated', includeSimulated: true, includeCoreServer: false })
    // Task 3 M6 row 113 (C3 §2.5): the three simulated STT configuration operations 90-92 join the offline scope, 23 -> 26.
    // Task 3 R-9..R-11, row 132 (C3 §2.6, §10.1): the five simulated operations 93-97 join it, 26 -> 31.
    // Task 4 blueprint row 63 (design addendum 4.2): the two simulated sound-card operations 98-99 join it, 31 -> 33.
    // Task 4 blueprint row 194: the simulated operation 100 (the confirmed re-address) joins it, 33 -> 34.
    // Task 4 blueprint row 102: the seven simulated commissioning operations 101-107 join it, 34 -> 41.
    // Task 4 row V3: the simulated operation 108 (the stored-credential connection test) joins it, 41 -> 42.
    // Task 4 blueprint row 116: the two simulated operations 109-110 of the installation acceptance join it, 42 -> 44.
    // Task 4 row RD2: the simulated operation 111 (the retirement of a device) joins it, 44 -> 45.
    expect(countOperations(view)).toBe(45)
    expect(serializeOpenApiDocument(view)).toBe(serializeOpenApiDocument(buildApiDocument(true)))
    expect(apiDocumentJsonFor({ mode: 'simulated', includeSimulated: true, includeCoreServer: false })).toBe(apiDocumentJson(true))
    expect(apiDocumentJsonFor({ mode: 'simulated', includeSimulated: false, includeCoreServer: false })).toBe(apiDocumentJson(false))
  })

  it('"Show Core-server endpoints" lists 119: the 45 unchanged, the other 74 with CORE SERVER in place of LIVE', () => {
    const plain = buildApiDocument(true)
    const view = buildApiDocumentFor({ mode: 'simulated', includeSimulated: true, includeCoreServer: true })
    // The registry total of C3 §10.1 (89 + ops 90-92 + ops 93-97) + the two of task 4 row 63 (ops 98-99,
    // both simulated) + the one of row 194 (op 100, simulated); the Core-server-only count stays 66.
    // Task 4 row 102: + the seven commissioning operations 101-107 (all simulated); the 66 still do not move.
    // Task 4 row V3: + operation 108 (simulated); the 66 still do not move.
    // Task 4 blueprint row 116: + operations 109-110 (simulated); the 66 still do not move.
    // Task 4 row RD2: + operation 111 (simulated); the 66 still do not move.
    // 2026-11-03 sweep: + the eight Core-server-only operations of f85e9c01 and D57c (ops 118/119,
    // getPanelSetup/setPanelSetup), none simulated: 111 -> 119, the 66 -> 74.
    expect(countOperations(view)).toBe(119)
    expect(CORE_SERVER_ONLY_OPERATIONS).toHaveLength(74)
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

  it('with "Show simulated endpoints" off as well: health and the 74 (75)', () => {
    const view = buildApiDocumentFor({ mode: 'simulated', includeSimulated: false, includeCoreServer: true })
    // 2026-11-03 sweep: the eight new Core-server-only operations of f85e9c01 and D57c (ops 118/119): 67 -> 75.
    expect(countOperations(view)).toBe(75)
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

  it('the 45 route as before with the switch on: health to the network, the 44 to the simulator', async () => {
    const { request, networkFetch, fetch } = await harness(CORE_ONLY)
    await fetch(`${CORE_HTTP_ORIGIN}/api/v1/health`)
    expect(networkFetch).toHaveBeenCalledTimes(1)
    for (const operation of CORE_API_OPERATIONS.filter(isOfflineCoreApiOperation).filter((candidate) => candidate.operationId !== 'getServiceHealth')) {
      const response = await fetch(new Request(`${CORE_HTTP_ORIGIN}${operation.path.replace('{id}', 'SES-20261001-0001')}`, { method: operation.method.toUpperCase(), ...(operation.method === 'post' ? { body: '{}' } : {}) }))
      expect(response.headers.get('x-dems-simulated'), operation.operationId).toBe('1')
    }
    // 25 until task 3 row 132 added the five simulated operations 93-97 (C3 §2.6).
    // 30 until task 4 row 63 added the two simulated sound-card operations 98-99 (design addendum 4.2).
    // 32 until task 4 row 194 added the simulated operation 100.
    // 33 until task 4 row 102 added the seven simulated commissioning operations 101-107.
    // 40 until task 4 row V3 added the simulated operation 108.
    // 41 until task 4 row 116 added the two simulated operations 109-110 of the installation acceptance.
    // 43 until task 4 row RD2 added the simulated operation 111, the retirement of a device.
    expect(request).toHaveBeenCalledTimes(44)
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

  it('119 operations, every one LIVE, served from the page\'s own origin and from nowhere else', () => {
    const document = buildLiveApiDocument(NO_REPLICA_IDENTIFIERS)
    // 2026-11-03 sweep: + the eight Core-server-only operations of f85e9c01 and D57c (ops 118/119,
    // getPanelSetup/setPanelSetup - web-console-only, LIVE, never simulated): 111 -> 119.
    expect(countOperations(document)).toBe(119)
    for (const [operationId, badges] of badgesOf(document)) expect(badges[0], operationId).toBe('LIVE')
    expect(document.servers.map((server) => server.url)).toEqual([PAGE])
    expect(document.info.version).toBe('0.3.0')
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

  it('every one of the 105 operations that are not denied goes to the network (the simulated ones too)', async () => {
    const { fetch, networkFetch } = liveHarness()
    const allowed = CORE_API_OPERATIONS.filter((operation) => !(TRY_IT_DENIED_OPERATIONS as readonly string[]).includes(operation.operationId))
    // 97 of the registry (C3 §10.1) minus the ten of AR-3a (six of 01_specs §7.7, operations 89
    // and 91 of task 3: row 113 fix round 1, navigator finding N-2, and operations 95 and 96 of the
    // camera connect flow: row 132, C3 §2.6 "Web Try-it"). Task 4 row 63: 99 of the registry minus
    // the same ten - the two sound-card operations 98-99 carry no secret and are not denied.
    // Task 4 row 194: 100 minus the same ten - the body of operation 100 holds ids and an address, no secret.
    // Task 4 row 102: 107 minus ELEVEN - six of the seven commissioning operations carry no secret;
    // the seventh, `setCameraNetwork`, carries a camera credential and joined the deny list (10 -> 11).
    // Task 4 row V3: 108 minus the same eleven - operation 108 has NO body and its answer holds no
    // secret, so the rule AR-3a ("the body or the answer holds a secret") does not name it. Whether a
    // test that makes the Core use a STORED credential should be offered for Try-it is put to the
    // controller as a request of row V3; no product line of the web was changed by that row.
    // Wave 11 (decision C67 (1)): the ruling is given - operation 108 is DENIED (11 -> 12), under a
    // reason and a sentence of its own, so 108 minus twelve: 97 -> 96.
    // Task 4 blueprint row 116: 110 minus FOURTEEN - operations 109 and 110 (the installation
    // acceptance and its revocation) change a stored record and are denied (12 -> 14), so the
    // count stays 96.
    // Task 4 row RD2: 111 minus the same fourteen - operation 111 (the retirement of a device) is not on
    // the deny list yet: 96 -> 97 FOR NOW. It changes a stored record and destroys a credential, as 109 /
    // 110 change one; its deny entry is row RD5's (request line of row RD2), which takes this back to 96.
    // 2026-11-03 sweep: 119 minus the same fourteen - the eight operations of f85e9c01 and D57c
    // (ops 118/119, getPanelSetup/setPanelSetup) carry no secret, no stored credential use and no
    // stored-record change of the kind the list names, so none joins it: 97 -> 105.
    expect(allowed).toHaveLength(105)
    for (const operation of allowed) {
      await fetch(new Request(`${PAGE}${operation.path.replace('{id}', 'X-1')}`, { method: operation.method.toUpperCase() }))
    }
    expect(networkFetch).toHaveBeenCalledTimes(105)
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

describe('AR-3a: the ten operations are rejected before a request (AC-C-103)', () => {
  beforeEach(() => setCoreEndpointMode('LIVE'))

  /** A body that carries every marker of AC-C-107. */
  const markedBody = JSON.stringify({ username: 'andi.pratama', password: MARKER_PASSWORD, code: MARKER_CODE, token: MARKER_BEARERS[2], credential: MARKER_BEARERS[1], session: MARKER_BEARERS[0] })

  it.each(TRY_IT_DENIED_OPERATIONS.map((operationId) => [operationId] as const))('%s: the sentence of AR-3a, no request', async (operationId) => {
    const networkFetch = vi.fn<FetchLike>(async () => new Response('{}'))
    const fetch = createLiveTryItFetch({ secretRefusal: SECRET, networkFetch })
    const call = fetch(new Request(`${PAGE}${pathOf(operationId)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: markedBody }))
    await expect(call).rejects.toBeInstanceOf(TryItRefusedError)
    // Decision C67 (1): an operation that uses a STORED credential is refused under its own reason; without a sentence of its own it reads the sentence of AR-3a.
    // Row 116: an operation that changes a stored record of the Core (109, 110) likewise.
    const reason = (TRY_IT_STORED_CREDENTIAL_OPERATIONS as readonly string[]).includes(operationId) ? 'STORED_CREDENTIAL' : (TRY_IT_STORED_RECORD_OPERATIONS as readonly string[]).includes(operationId) ? 'STORED_RECORD' : 'SECRET'
    await expect(call).rejects.toMatchObject({ message: SECRET, reason, method: 'POST', path: pathOf(operationId) })
    expect(networkFetch).not.toHaveBeenCalled()
    expect(webErrorSink.records().at(-1)).toMatchObject({ source: 'ApiReference.liveTryIt.denied', context: { method: 'POST', path: pathOf(operationId) } })
    assertLogDiscipline()
  })

  // Decision C67 (1): operation 108 (`POST /api/v1/capture/devices/{id}/test`, no body) makes the Core
  // use a STORED camera credential against a device on the network and counts towards the lock-out guard.
  it('C67 (1): testCaptureDeviceConnection never reaches the network, in any spelling, and its refusal says what is true of it - not "carries a secret"', async () => {
    expect(TRY_IT_STORED_CREDENTIAL_OPERATIONS).toEqual(['testCaptureDeviceConnection'])
    expect(TRY_IT_DENIED_OPERATIONS as readonly string[]).toContain('testCaptureDeviceConnection')
    const STORED = 'This operation makes the Core use a stored credential.'
    const networkFetch = vi.fn<FetchLike>(async () => new Response('{}'))
    const fetch = createLiveTryItFetch({ secretRefusal: SECRET, storedCredentialRefusal: STORED, networkFetch })
    const path = '/api/v1/capture/devices/CAM-04/test'
    for (const spelling of [path, `${path}/`, path.toUpperCase().replace('/API/V1', '/api/v1'), '/api/v1//capture/devices/CAM-04/test']) {
      const call = fetch(new Request(`${PAGE}${spelling}`, { method: 'POST' }))
      await expect(call, spelling).rejects.toBeInstanceOf(TryItRefusedError)
      await expect(call, spelling).rejects.toMatchObject({ message: STORED, reason: 'STORED_CREDENTIAL', method: 'POST' })
    }
    expect(networkFetch).not.toHaveBeenCalled()
    expect(webErrorSink.records().at(-1)).toMatchObject({ source: 'ApiReference.liveTryIt.denied', message: 'A Try-it request of an operation that uses a stored credential was refused.' })
    // CONTROL: the read of the same camera's devices list is not denied.
    await fetch(new Request(`${PAGE}/api/v1/capture/devices`))
    expect(networkFetch).toHaveBeenCalledTimes(1)
    assertLogDiscipline()
  })

  // Task 4 row 116 (request of agent A5): operations 109 and 110 write and revoke the stored
  // installation acceptance of a Core. No secret, no stored credential: a reason and a sentence of their own.
  it('row 116: acceptInstallation and revokeInstallationAcceptance never reach the network, in any spelling, and are refused as operations that change a stored record', async () => {
    expect(TRY_IT_STORED_RECORD_OPERATIONS).toEqual(['acceptInstallation', 'revokeInstallationAcceptance'])
    const RECORD = 'This operation changes the installation record of the Core.'
    const networkFetch = vi.fn<FetchLike>(async () => new Response('{}'))
    const fetch = createLiveTryItFetch({ secretRefusal: SECRET, storedRecordRefusal: RECORD, networkFetch })
    for (const operationId of TRY_IT_STORED_RECORD_OPERATIONS) {
      expect(TRY_IT_DENIED_OPERATIONS as readonly string[]).toContain(operationId)
      const path = pathOf(operationId)
      for (const spelling of [path, `${path}/`, path.toUpperCase().replace('/API/V1', '/api/v1')]) {
        const call = fetch(new Request(`${PAGE}${spelling}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))
        await expect(call, spelling).rejects.toBeInstanceOf(TryItRefusedError)
        await expect(call, spelling).rejects.toMatchObject({ message: RECORD, reason: 'STORED_RECORD', method: 'POST' })
      }
    }
    expect(networkFetch).not.toHaveBeenCalled()
    expect(webErrorSink.records().at(-1)).toMatchObject({ source: 'ApiReference.liveTryIt.denied', message: 'A Try-it request of an operation that changes a stored record of the Core was refused.' })
    assertLogDiscipline()
  })

  // Task 3 row 113, fix round 1 (navigator finding N-2; decision AR-3a 6 -> 8): the two operations of
  // task 3 whose request body holds a credential. Their registry texts say "no Try it"; this is the control.
  it.each([
    ['updateSttConfig', '/api/v1/transcription/config', { revision: 1, credential: { kind: 'SECRET', value: MARKER_PASSWORD } }],
    ['setCaptureDeviceCredential', '/api/v1/capture/devices/CAM-01/credential', { username: 'onvif', secret: MARKER_PASSWORD }],
    // Task 3 R-9 (row 132, D106; C3 §2.6 "Web Try-it"; AR-3a 8 -> 10): the two operations of the camera connect flow.
    ['testCaptureCandidateConnection', '/api/v1/capture/discovery/candidates/CND-4F2A91C0D377/test', { credential: { username: 'onvif', secret: MARKER_PASSWORD } }],
    ['adoptCaptureCandidate', '/api/v1/capture/discovery/candidates/CND-4F2A91C0D377/adopt', { credential: { username: 'onvif', secret: MARKER_PASSWORD } }],
    // Task 4 row 102 (design F-4.2 DR-8; AR-3a 10 -> 11): the set-network job, the fourth operation whose body carries a camera credential.
    ['setCameraNetwork', '/api/v1/capture/network/cameras/address', { fromAddress: '192.168.1.64', credential: { username: 'onvif', secret: MARKER_PASSWORD } }],
  ] as const)('N-2: %s (a credential in the body) never reaches the network', async (operationId, path, body) => {
    expect(TRY_IT_DENIED_OPERATIONS as readonly string[]).toContain(operationId)
    const networkFetch = vi.fn<FetchLike>(async () => new Response('{}'))
    const fetch = createLiveTryItFetch({ secretRefusal: SECRET, networkFetch })
    for (const spelling of [path, `${path}/`, path.toUpperCase().replace('/API/V1', '/api/v1')]) {
      const call = fetch(new Request(`${PAGE}${spelling}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
      await expect(call, spelling).rejects.toBeInstanceOf(TryItRefusedError)
      await expect(call, spelling).rejects.toMatchObject({ message: SECRET, reason: 'SECRET' })
    }
    expect(networkFetch).not.toHaveBeenCalled()
    assertLogDiscipline()
  })

  it('N-2: the deny list holds ten; the read and the test of the STT configuration and the camera search, its read and the microphone re-read, which carry no credential, still go to the network', async () => {
    // Eleven since task 4 row 102 (`setCameraNetwork`); they are the contract's four credential-carrying operations and the seven other secret-bearing ones.
    // Twelve since wave 11 (decision C67 (1)): `testCaptureDeviceConnection`, which carries no secret and uses a stored one.
    // Fourteen since row 116 (request of agent A5): `acceptInstallation` and `revokeInstallationAcceptance`, which change a stored record.
    expect(TRY_IT_DENIED_OPERATIONS).toHaveLength(14)
    for (const operationId of CREDENTIAL_CARRYING_OPERATIONS) expect(TRY_IT_DENIED_OPERATIONS as readonly string[]).toContain(operationId)
    const networkFetch = vi.fn<FetchLike>(async () => new Response('{}'))
    const fetch = createLiveTryItFetch({ secretRefusal: SECRET, networkFetch })
    await fetch(new Request(`${PAGE}/api/v1/transcription/config`))
    await fetch(new Request(`${PAGE}/api/v1/transcription/config/test`, { method: 'POST' }))
    await fetch(new Request(`${PAGE}/api/v1/capture/config`))
    // Operations 93, 94 and 97 (C3 §2.6): no credential in any of them.
    await fetch(new Request(`${PAGE}/api/v1/capture/discovery`, { method: 'POST' }))
    await fetch(new Request(`${PAGE}/api/v1/capture/discovery`))
    await fetch(new Request(`${PAGE}/api/v1/capture/inputs/rescan`, { method: 'POST' }))
    expect(networkFetch).toHaveBeenCalledTimes(6)
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
