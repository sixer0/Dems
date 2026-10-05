// Plan row W50: the Live row of `lib/core-endpoint.ts` (backend task 04_client_integration_spec
// §4.2; AC-C-36). The Simulated rows are `core-endpoint.test.tsx`, which runs unchanged: without a
// call of `setCoreEndpointMode` the resolvers behave as before.
//
// jsdom page: http://localhost:3000/ (the resolvers follow whatever page they are given; where the
// console may be opened in Live mode is the runtime's rule, `runtime/live-host.ts`).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CORE_HTTP_ORIGIN, CORE_WS_URL, HEALTH_PATH, WEB_DEV_ORIGINS, type HealthResponse } from '@dems/shared/api'
import { ALWAYS_VISIBLE, createSim, type Sim } from '@dems/shared/sim'
import { QueryClient } from '@tanstack/react-query'
import { coreAddress } from '@/features/login/login-model'
import { createAppRouter } from '@/router'
import { CORE_MODE_STORAGE_KEY } from '@/runtime/core-mode'
import {
  allowedPageOrigins,
  coreHttpOrigin,
  coreWsUrl,
  fetchCoreHealth,
  isLiveCore,
  isSameOriginCore,
  pageWsUrl,
  setCoreEndpointMode,
  type PageLocation,
} from '../core-endpoint'
import { CORE_ORIGIN_ENV_KEY, SAME_ORIGIN_CORE } from '../packaged-csp'

const PAGE = window.location
const LANE_PAGE: PageLocation = { origin: 'http://127.0.0.1:5178', protocol: 'http:', host: '127.0.0.1:5178' }
const HTTPS_PAGE: PageLocation = { origin: 'https://127.0.0.1:5178', protocol: 'https:', host: '127.0.0.1:5178' }

const coreServerHealth: HealthResponse = {
  status: 'ok',
  service: 'dems-core-server',
  version: '0.2.0',
  apiVersion: 'v1',
  serverTime: '2026-10-04T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 2 },
  ready: { database: true, engine: true },
}

const sims: Sim[] = []

afterEach(() => {
  setCoreEndpointMode('SIMULATED')
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  window.localStorage.clear()
  for (const sim of sims.splice(0)) sim.stop()
})

describe('the Live row (§4.2): the page talks to the Core server through its own origin', () => {
  it('REST origin, socket and allowed origins follow the page', () => {
    setCoreEndpointMode('LIVE')
    expect(isLiveCore()).toBe(true)
    expect(isSameOriginCore()).toBe(false)
    expect(coreHttpOrigin()).toBe(PAGE.origin)
    expect(coreWsUrl()).toBe(`ws://${PAGE.host}/ws`)
    expect(allowedPageOrigins()).toEqual([PAGE.origin])
    expect(coreHttpOrigin(LANE_PAGE)).toBe('http://127.0.0.1:5178')
    expect(coreWsUrl(LANE_PAGE)).toBe('ws://127.0.0.1:5178/ws')
    expect(allowedPageOrigins(LANE_PAGE)).toEqual(['http://127.0.0.1:5178'])
    expect(coreWsUrl(HTTPS_PAGE)).toBe('wss://127.0.0.1:5178/ws')
    expect(pageWsUrl(LANE_PAGE)).toBe('ws://127.0.0.1:5178/ws')
    // Nothing of mock-core is left in the row.
    for (const value of [coreHttpOrigin(LANE_PAGE), coreWsUrl(LANE_PAGE), ...allowedPageOrigins(LANE_PAGE)]) {
      expect(value).not.toContain('4400')
    }
  })

  it('is read at call time: back to the Simulated row when the mode is set back', () => {
    expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
    setCoreEndpointMode('LIVE')
    expect(coreHttpOrigin()).toBe(PAGE.origin)
    setCoreEndpointMode('SIMULATED')
    expect(isLiveCore()).toBe(false)
    expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
    expect(coreWsUrl()).toBe(CORE_WS_URL)
    expect(allowedPageOrigins()).toEqual(WEB_DEV_ORIGINS)
  })

  it('the stored mode is NOT read here: a mode another tab stored cannot move an open Simulated page onto the Core server', () => {
    window.localStorage.setItem(CORE_MODE_STORAGE_KEY, 'LIVE')
    vi.stubEnv('VITE_DEMS_CORE_MODE', 'live')
    expect(isLiveCore()).toBe(false)
    expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
    expect(coreWsUrl()).toBe(CORE_WS_URL)
    expect(allowedPageOrigins()).toEqual(WEB_DEV_ORIGINS)
  })

  it('MD-6: a production build has no Live row, whatever was set', () => {
    setCoreEndpointMode('LIVE')
    vi.stubEnv('DEV', false)
    expect(import.meta.env.DEV).toBe(false)
    expect(isLiveCore()).toBe(false)
    expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
    expect(coreWsUrl()).toBe(CORE_WS_URL)
  })

  it('the packaged build stays the packaged row: it is never Live', () => {
    setCoreEndpointMode('LIVE')
    vi.stubEnv(CORE_ORIGIN_ENV_KEY, SAME_ORIGIN_CORE)
    expect(isSameOriginCore()).toBe(true)
    expect(isLiveCore()).toBe(false)
    expect(coreHttpOrigin()).toBe(PAGE.origin)
  })

  it('the router factory selects the row from its data source: a simulator means Simulated', () => {
    setCoreEndpointMode('LIVE')
    const sim = createSim({ storage: null, authStorage: null, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    createAppRouter({ sim, queryClient: new QueryClient() })
    expect(isLiveCore()).toBe(false)
    expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
  })
})

describe('fetchCoreHealth in Live mode', () => {
  const okFetch = () => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(coreServerHealth), { status: 200 }))

  it('GET {page origin}/api/v1/health, and the Core server\'s answer passes the shared schema', async () => {
    setCoreEndpointMode('LIVE')
    const fetchImpl = okFetch()
    await expect(fetchCoreHealth(fetchImpl)).resolves.toEqual(coreServerHealth)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([`${PAGE.origin}${HEALTH_PATH}`])
    const global = okFetch()
    vi.stubGlobal('fetch', global)
    await expect(fetchCoreHealth()).resolves.toMatchObject({ service: 'dems-core-server', ready: { database: true, engine: true } })
    expect(global).toHaveBeenCalledWith(`${PAGE.origin}${HEALTH_PATH}`, undefined)
  })

  it('an answer of the dev server that is no health body is refused (the proxy with the backend down, WT-4)', async () => {
    setCoreEndpointMode('LIVE')
    await expect(fetchCoreHealth(vi.fn<typeof fetch>(async () => new Response('', { status: 502 })))).rejects.toThrow('HTTP 502')
    await expect(fetchCoreHealth(vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 })))).rejects.toThrow()
  })
})

describe('a call site follows the row', () => {
  it('coreAddress: the Login page\'s offline Alert names the page\'s own host in Live mode', () => {
    expect(coreAddress()).toBe('127.0.0.1:4400')
    setCoreEndpointMode('LIVE')
    expect(coreAddress()).toBe(PAGE.host)
  })
})
