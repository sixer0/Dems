// Step 53: simAwareFetch (masterplan/01_specs.md §14.9; AC-58; D61). LIVE health goes to the
// network unchanged; every other Core API path is answered by the in-browser simulator with
// `x-dems-simulated: 1`; export follows the signed-in role (INVESTIGATOR 403 plus an audit row,
// SUPERVISOR 202); anything else is rejected before it can leave the machine. Also covers the
// W53-1..4 cases, answered by the simulator itself since step 54 (D101).
// Every simulator runs on a manual clock pinned to the DEMO packages' `datasetNow`, so the evidence
// ID of the demo-data export example exists on any calendar day and at any hour.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CORE_HTTP_ORIGIN, validateCoreApiResponse, type HealthResponse } from '@dems/shared/api'
import { DEMO_EVIDENCE_INDEX } from '@dems/shared/demo-data'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  type ScenarioName,
  type Sim,
} from '@dems/shared/sim'
import { BlockedRequestError, createSimAwareFetch, type FetchLike, type TryItExchange } from '@/features/api-reference/sim-fetch'

/**
 * The instant the DEMO packages describe (2026-10-01T10:00+07:00). The simulator builds evidence
 * IDs from its clock (`EV-<YYYYMMDD>-<seq>`), and `apiExamples.evidenceExport` names one of them:
 * without this pin the ID exists only while the wall-clock date is the packages' date.
 */
const DATASET_NOW = Date.parse(DEMO_EVIDENCE_INDEX.datasetNow)

const sims: Sim[] = []

afterEach(() => {
  for (const sim of sims.splice(0)) sim.destroy()
})

async function makeSim(operatorId: string | null, scenario: ScenarioName = 'idle'): Promise<Sim> {
  const authStorage = createMemoryAuthStorage()
  if (operatorId) authStorage.save({ operatorId, issuedAt: DATASET_NOW })
  const sim = createSim({
    clock: createManualClock(DATASET_NOW),
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
    scenario,
  })
  sims.push(sim)
  await sim.ready
  return sim
}

const health: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-10-01T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
}

function harness(sim: Sim) {
  const networkFetch = vi.fn<FetchLike>(async () =>
    new Response(JSON.stringify(health), { status: 200, headers: { 'content-type': 'application/json' } }),
  )
  const exchanges: TryItExchange[] = []
  const fetch = createSimAwareFetch({ sim, networkFetch, onExchange: (e) => exchanges.push(e) })
  return { fetch, networkFetch, exchanges }
}

const api = (path: string) => `${CORE_HTTP_ORIGIN}${path}`
const { evidenceExport } = DEMO_EVIDENCE_INDEX.apiExamples

function postJson(path: string, body: unknown): Request {
  // What Scalar's sendRequest hands to customFetch (a Request, not a URL and an init).
  return new Request(api(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

describe('simAwareFetch: LIVE passthrough', () => {
  it('sends GET /api/v1/health to the real network and returns its response unchanged', async () => {
    const sim = await makeSim(OPERATOR_IDS.BUDI)
    const { fetch, networkFetch, exchanges } = harness(sim)
    const request = new Request(api('/api/v1/health'))
    const response = await fetch(request)
    expect(networkFetch).toHaveBeenCalledTimes(1)
    expect(networkFetch.mock.calls[0]?.[0]).toBe(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-dems-simulated')).toBeNull()
    expect(await response.json()).toEqual(health)
    expect(exchanges).toEqual([{ mode: 'live', method: 'GET', path: '/api/v1/health', status: 200 }])
  })

  it('accepts a plain URL string as well', async () => {
    const sim = await makeSim(OPERATOR_IDS.BUDI)
    const { fetch, networkFetch } = harness(sim)
    await fetch(api('/api/v1/health'))
    expect(networkFetch).toHaveBeenCalledTimes(1)
  })
})

describe('simAwareFetch: SIMULATED answers', () => {
  it('answers GET /api/v1/session/current from the simulator with x-dems-simulated: 1', async () => {
    const sim = await makeSim(OPERATOR_IDS.BUDI, 'recording')
    const { fetch, networkFetch, exchanges } = harness(sim)
    const response = await fetch(new Request(api('/api/v1/session/current')))
    expect(networkFetch).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(response.headers.get('x-dems-simulated')).toBe('1')
    const body = (await response.json()) as { session: { id: string; state: string } | null }
    expect(validateCoreApiResponse('getCurrentSession', 200, body)).toEqual({ ok: true })
    expect(body.session?.id).toBe(sim.store.getState().session?.id)
    expect(body.session?.state).toBe('RECORDING')
    expect(exchanges.at(-1)).toMatchObject({ mode: 'simulated', status: 200 })
  })

  it('export as INVESTIGATOR: 403 FORBIDDEN and an EXPORT_DENIED audit row', async () => {
    const sim = await makeSim(OPERATOR_IDS.BUDI)
    const { fetch } = harness(sim)
    const response = await fetch(postJson(`/api/v1/evidence/${evidenceExport.evidenceId}/export`, evidenceExport.request))
    expect(response.status).toBe(403)
    expect(response.headers.get('x-dems-simulated')).toBe('1')
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('FORBIDDEN')
    expect(validateCoreApiResponse('exportEvidence', 403, body)).toEqual({ ok: true })
    const rows = sim.store.getState().audit.rows
    expect(rows.at(-1)).toMatchObject({ type: 'EXPORT_DENIED', actorId: OPERATOR_IDS.BUDI, evidenceId: evidenceExport.evidenceId })
  })

  it('export as SUPERVISOR: 202 with an EVIDENCE_EXPORTED audit row (the demo-data payload)', async () => {
    const sim = await makeSim(OPERATOR_IDS.ANDI)
    const { fetch } = harness(sim)
    const response = await fetch(postJson(`/api/v1/evidence/${evidenceExport.evidenceId}/export`, evidenceExport.request))
    expect(response.status).toBe(202)
    const body = (await response.json()) as { exportId: string; evidenceId: string; status: string }
    expect(validateCoreApiResponse('exportEvidence', 202, body)).toEqual({ ok: true })
    expect(body).toMatchObject({ evidenceId: evidenceExport.evidenceId, status: 'EXPORTED' })
    expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_EXPORTED', actorId: OPERATOR_IDS.ANDI })
  })

  it('creates a session from the demo-data request body (201)', async () => {
    const sim = await makeSim(OPERATOR_IDS.BUDI)
    const { fetch } = harness(sim)
    const response = await fetch(postJson('/api/v1/session', DEMO_EVIDENCE_INDEX.apiExamples.sessionCreate.request))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(validateCoreApiResponse('createSession', 201, body)).toEqual({ ok: true })
    expect(sim.store.getState().session?.input.caseNumber).toBe(DEMO_EVIDENCE_INDEX.apiExamples.sessionCreate.request.caseNumber)
  })
})

describe('simAwareFetch: blocked requests', () => {
  it.each([
    'https://example.com/api/v1/health',
    'http://localhost:4400/api/v1/health',
    `${CORE_HTTP_ORIGIN}/ws`,
    `${CORE_HTTP_ORIGIN}/openapi.json`,
    'https://proxy.scalar.com/?scalar_url=http%3A%2F%2F127.0.0.1%3A4400%2Fapi%2Fv1%2Fhealth',
  ])('rejects %s without calling the network', async (url) => {
    const sim = await makeSim(OPERATOR_IDS.BUDI)
    const { fetch, networkFetch, exchanges } = harness(sim)
    await expect(fetch(url)).rejects.toBeInstanceOf(BlockedRequestError)
    expect(networkFetch).not.toHaveBeenCalled()
    expect(exchanges).toEqual([])
  })
})

describe('simAwareFetch: W53 cases (the simulator answers them since step 54)', () => {
  it('W53-1: malformed percent-encoding is a 400, never a throw', async () => {
    const sim = await makeSim(OPERATOR_IDS.BUDI)
    const { fetch } = harness(sim)
    const response = await fetch(new Request(api('/api/v1/session/%E0%A4%A/start'), { method: 'POST', body: '{}' }))
    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('INVALID_PATH')
  })

  it('W53-2: a method the simulator does not model gets 405 with Allow', async () => {
    const sim = await makeSim(OPERATOR_IDS.BUDI)
    const { fetch } = harness(sim)
    const response = await fetch(new Request(api('/api/v1/session/current'), { method: 'PUT', body: '{}' }))
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET')
    expect(response.headers.get('x-dems-simulated')).toBe('1')
  })

  it('W53-3: a case number outside LP/YYYY/MMDD-NNNN gets the documented 422', async () => {
    const sim = await makeSim(OPERATOR_IDS.BUDI)
    const { fetch } = harness(sim)
    const bad = { ...DEMO_EVIDENCE_INDEX.apiExamples.sessionCreate.request, caseNumber: 'not-a-case' }
    const response = await fetch(postJson('/api/v1/session', bad))
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(validateCoreApiResponse('createSession', 422, body)).toEqual({ ok: true })
    expect(sim.store.getState().session).toBeNull()
  })

  it('W53-4: session commands need SESSION_START (TECHNICIAN 403, signed out 401)', async () => {
    const technician = await makeSim(OPERATOR_IDS.RINA, 'recording')
    const sessionId = technician.store.getState().session?.id ?? ''
    const denied = await harness(technician).fetch(postJson(`/api/v1/session/${sessionId}/stop`, { reason: 'Interview completed' }))
    expect(denied.status).toBe(403)
    expect(technician.store.getState().session?.state).toBe('RECORDING')

    const signedOut = await makeSim(null, 'recording')
    const anonymous = await harness(signedOut).fetch(postJson(`/api/v1/session/${sessionId}/stop`, { reason: 'Interview completed' }))
    expect(anonymous.status).toBe(401)
  })
})
