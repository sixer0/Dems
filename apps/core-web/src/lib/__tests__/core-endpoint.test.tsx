// Step 100 (06_packaging_spec §3.4, PK-12; D104): the Core address in both build modes.
// - Unit: the four resolvers with `VITE_DEMS_CORE_ORIGIN` unset, set to another value, and set to
//   `same-origin` (jsdom page http://localhost:3000, plus injected https/other-port locations).
// - fetchCoreHealth (shared fetchHealth through its fetchImpl seam) and the OpenAPI re-point.
// - Call sites: coreAddress, the OpenAPI document, simAwareFetch routing.
// - Wiring: the real router on /developer/api and /stack-check. The heartbeat sockets (app-wide
//   provider and Realtime panel) and the health fetches go to 127.0.0.1:4400 in dev mode and to
//   the page's own origin in the packaged mode.
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CORE_HTTP_ORIGIN,
  CORE_WS_URL,
  createOpenApiDocument,
  HEALTH_PATH,
  serializeOpenApiDocument,
  WEB_DEV_ORIGINS,
  type HealthResponse,
} from '@dems/shared/api'
import type { SocketLike } from '@dems/shared/realtime'
import { ALWAYS_VISIBLE, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { buildApiDocument, pointAtCoreOrigin } from '@/features/api-reference/api-document'
import { BlockedRequestError, createSimAwareFetch, type FetchLike } from '@/features/api-reference/sim-fetch'
import { coreAddress } from '@/features/login/login-model'
import { createAppRouter } from '@/router'
import {
  allowedPageOrigins,
  coreHttpOrigin,
  coreWsUrl,
  fetchCoreHealth,
  isSameOriginCore,
  type PageLocation,
} from '../core-endpoint'
import { CORE_ORIGIN_ENV_KEY, SAME_ORIGIN_CORE } from '../packaged-csp'

const PAGE = window.location // jsdom: http://localhost:3000/

const health: HealthResponse = {
  status: 'ok',
  service: 'dems-mock-core',
  version: '0.1.0',
  apiVersion: 'v1',
  serverTime: '2026-10-01T03:00:00.000Z',
  uptimeMs: 1000,
  ws: { path: '/ws', heartbeatIntervalMs: 1000, clients: 1 },
}
const HTTPS_PAGE: PageLocation = { origin: 'https://127.0.0.1:4410', protocol: 'https:', host: '127.0.0.1:4410' }
const LAUNCHER_PAGE: PageLocation = { origin: 'http://127.0.0.1:4411', protocol: 'http:', host: '127.0.0.1:4411' }

function packagedMode() {
  vi.stubEnv(CORE_ORIGIN_ENV_KEY, SAME_ORIGIN_CORE)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('core-endpoint resolvers', () => {
  it('reads the env key the spec names, with the one meaningful value', () => {
    expect(CORE_ORIGIN_ENV_KEY).toBe('VITE_DEMS_CORE_ORIGIN')
    expect(SAME_ORIGIN_CORE).toBe('same-origin')
  })

  it('dev mode (unset): the 127.0.0.1:4400 constants and the 5173 allowlist, whatever the page is', () => {
    expect(import.meta.env.VITE_DEMS_CORE_ORIGIN).toBeUndefined()
    expect(isSameOriginCore()).toBe(false)
    expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
    expect(coreHttpOrigin()).toBe('http://127.0.0.1:4400')
    expect(coreWsUrl()).toBe(CORE_WS_URL)
    expect(coreWsUrl()).toBe('ws://127.0.0.1:4400/ws')
    expect(allowedPageOrigins()).toEqual(WEB_DEV_ORIGINS)
    expect(coreHttpOrigin(LAUNCHER_PAGE)).toBe(CORE_HTTP_ORIGIN)
    expect(coreWsUrl(HTTPS_PAGE)).toBe(CORE_WS_URL)
    expect(allowedPageOrigins(LAUNCHER_PAGE)).toEqual(WEB_DEV_ORIGINS)
  })

  it('any value other than same-origin keeps the dev defaults', () => {
    for (const value of ['', 'true', 'SAME-ORIGIN', 'same_origin', 'http://127.0.0.1:4410']) {
      vi.stubEnv(CORE_ORIGIN_ENV_KEY, value)
      expect(isSameOriginCore()).toBe(false)
      expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
      expect(coreWsUrl()).toBe(CORE_WS_URL)
      expect(allowedPageOrigins()).toEqual(WEB_DEV_ORIGINS)
    }
  })

  it('packaged mode (same-origin): REST, socket and allowlist follow window.location', () => {
    packagedMode()
    expect(isSameOriginCore()).toBe(true)
    expect(coreHttpOrigin()).toBe(PAGE.origin)
    expect(coreWsUrl()).toBe(`ws://${PAGE.host}/ws`)
    expect(allowedPageOrigins()).toEqual([PAGE.origin])
  })

  it('packaged mode: the launcher port is whatever the page uses, and https maps to wss', () => {
    packagedMode()
    expect(coreHttpOrigin(LAUNCHER_PAGE)).toBe('http://127.0.0.1:4411')
    expect(coreWsUrl(LAUNCHER_PAGE)).toBe('ws://127.0.0.1:4411/ws')
    expect(allowedPageOrigins(LAUNCHER_PAGE)).toEqual(['http://127.0.0.1:4411'])
    expect(coreWsUrl(HTTPS_PAGE)).toBe('wss://127.0.0.1:4410/ws')
    expect(coreHttpOrigin(HTTPS_PAGE)).toBe('https://127.0.0.1:4410')
  })

  it('is evaluated at call time (no module-level constant)', () => {
    expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
    packagedMode()
    expect(coreHttpOrigin()).toBe(PAGE.origin)
    vi.unstubAllEnvs()
    expect(coreHttpOrigin()).toBe(CORE_HTTP_ORIGIN)
  })
})

describe('fetchCoreHealth', () => {
  const okFetch = () => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(health), { status: 200 }))

  it('dev mode: GET http://127.0.0.1:4400/api/v1/health (the shared fetcher, unchanged)', async () => {
    const fetchImpl = okFetch()
    await expect(fetchCoreHealth(fetchImpl)).resolves.toEqual(health)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(['http://127.0.0.1:4400/api/v1/health'])
  })

  it('dev mode without a fetchImpl uses the global fetch', async () => {
    const fetchImpl = okFetch()
    vi.stubGlobal('fetch', fetchImpl)
    try {
      await fetchCoreHealth()
      expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4400/api/v1/health')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('packaged mode: GET {page origin}/api/v1/health, with or without a fetchImpl', async () => {
    packagedMode()
    const fetchImpl = okFetch()
    await expect(fetchCoreHealth(fetchImpl)).resolves.toEqual(health)
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([`${PAGE.origin}${HEALTH_PATH}`])
    const global = okFetch()
    vi.stubGlobal('fetch', global)
    try {
      await fetchCoreHealth()
      expect(global).toHaveBeenCalledWith(`${PAGE.origin}${HEALTH_PATH}`, undefined)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('packaged mode still validates the body and the status (shared HealthResponseSchema)', async () => {
    packagedMode()
    await expect(fetchCoreHealth(vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 })))).rejects.toThrow()
    await expect(fetchCoreHealth(vi.fn<typeof fetch>(async () => new Response('', { status: 503 })))).rejects.toThrow(
      'HTTP 503',
    )
  })
})

describe('pointAtCoreOrigin (OpenAPI document)', () => {
  it('dev mode: the shared document is returned untouched (same object, same bytes)', () => {
    const document = createOpenApiDocument()
    const before = serializeOpenApiDocument(document)
    expect(pointAtCoreOrigin(document)).toBe(document)
    expect(serializeOpenApiDocument(document)).toBe(before)
  })

  it('packaged mode: only servers[0].url and the two address strings change', () => {
    packagedMode()
    const pointed = serializeOpenApiDocument(pointAtCoreOrigin(createOpenApiDocument()))
    const expected = serializeOpenApiDocument(createOpenApiDocument())
      .replace(`"url": "${CORE_HTTP_ORIGIN}"`, `"url": "${PAGE.origin}"`)
      .replaceAll(`\`${CORE_HTTP_ORIGIN}\``, `\`${PAGE.origin}\``)
      .replaceAll(`\`${CORE_WS_URL}\``, `\`ws://${PAGE.host}/ws\``)
    expect(pointed).toBe(expected)
    expect(pointed).not.toBe(serializeOpenApiDocument(createOpenApiDocument()))
  })
})

describe('call sites in both modes', () => {
  it('coreAddress: the offline Alert names 127.0.0.1:4400 in dev and the page host when packaged', () => {
    expect(coreAddress()).toBe('127.0.0.1:4400')
    packagedMode()
    expect(coreAddress()).toBe(PAGE.host)
  })

  it('the OpenAPI document serves from the Core origin of the mode', () => {
    expect(buildApiDocument(true).servers[0]?.url).toBe(CORE_HTTP_ORIGIN)
    packagedMode()
    const document = buildApiDocument(true)
    expect(document.servers[0]?.url).toBe(PAGE.origin)
    expect(document.info.description).toContain(`\`${PAGE.origin}\``)
    const realtime = document.tags.find((tag) => tag.description.includes('WebSocket'))
    expect(realtime?.description).toContain(`\`ws://${PAGE.host}/ws\``)
    // The health operation's own prose still says "mock-core on 127.0.0.1:4400" (core-api.ts,
    // outside the §3.4 list); no URL to the dev Core remains.
    expect(JSON.stringify(document)).not.toContain('http://127.0.0.1:4400')
    expect(JSON.stringify(document)).not.toContain('ws://127.0.0.1:4400')
  })

  it('simAwareFetch sends LIVE health to the page origin when packaged, and blocks the dev Core', async () => {
    packagedMode()
    const sim = createSim({ storage: null, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    try {
      const networkFetch = vi.fn<FetchLike>(async () => new Response('{}', { status: 200 }))
      const fetch = createSimAwareFetch({ sim, networkFetch })
      const live = await fetch(`${PAGE.origin}${HEALTH_PATH}`)
      expect(live.status).toBe(200)
      expect(networkFetch).toHaveBeenCalledTimes(1)
      // Scalar may hand a relative URL: it resolves against the page origin too.
      await fetch(HEALTH_PATH)
      expect(networkFetch).toHaveBeenCalledTimes(2)
      const simulated = await fetch(`${PAGE.origin}/api/v1/storage/status`)
      expect(simulated.headers.get('x-dems-simulated')).toBe('1')
      await expect(fetch(`${CORE_HTTP_ORIGIN}${HEALTH_PATH}`)).rejects.toBeInstanceOf(BlockedRequestError)
      await expect(fetch(`${CORE_HTTP_ORIGIN}${HEALTH_PATH}`)).rejects.toThrow(`(${PAGE.origin}/api/v1)`)
      expect(networkFetch).toHaveBeenCalledTimes(2)
    } finally {
      sim.stop()
    }
  })
})

// ── Wiring through the real router ──────────────────────────────────────────────────────

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

describe('wiring: heartbeat sockets and health fetches', () => {
  const sims: Sim[] = []
  let socketUrls: string[]
  let fetchUrls: string[]

  beforeEach(() => {
    socketUrls = []
    fetchUrls = []
    Element.prototype.scrollTo ??= function scrollTo() {}
    vi.stubGlobal('scrollTo', () => undefined) // jsdom has no scrolling
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        fetchUrls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
        return new Response(JSON.stringify(health), { status: 200 })
      }),
    )
  })

  afterEach(() => {
    cleanup()
    for (const sim of sims.splice(0)) sim.stop()
    vi.unstubAllGlobals()
  })

  function mount(path: string) {
    const authStorage = createMemoryAuthStorage()
    authStorage.save({ operatorId: OPERATOR_IDS.BUDI, issuedAt: Date.now() })
    const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createAppRouter(
      {
        sim,
        queryClient,
        socketFactory: (url) => {
          socketUrls.push(url)
          return new SilentSocket()
        },
      },
      { history: createMemoryHistory({ initialEntries: [path] }) },
    )
    render(<RouterProvider router={router} />)
  }

  it.each([
    ['dev mode', false, CORE_HTTP_ORIGIN, CORE_WS_URL],
    ['packaged mode', true, PAGE.origin, `ws://${PAGE.host}/ws`],
  ] as const)('/developer/api in %s', async (_label, packaged, origin, wsUrl) => {
    if (packaged) packagedMode()
    mount('/developer/api')
    expect(await screen.findByTestId('page-api-reference')).toBeInTheDocument()
    expect(screen.getByTestId('api-base-url')).toHaveTextContent(origin)
    expect(screen.getByTestId('api-realtime-url')).toHaveTextContent(wsUrl)
    // The app-wide provider and the Realtime panel each open one socket, both on the mode's URL.
    await waitFor(() => expect(socketUrls.length).toBeGreaterThanOrEqual(2))
    expect(new Set(socketUrls)).toEqual(new Set([wsUrl]))
    await waitFor(() => expect(fetchUrls).toContain(`${origin}${HEALTH_PATH}`))
    expect(fetchUrls.every((url) => url === `${origin}${HEALTH_PATH}`)).toBe(true)
  })

  it.each([
    ['dev mode', false, CORE_HTTP_ORIGIN, CORE_WS_URL],
    ['packaged mode', true, PAGE.origin, `ws://${PAGE.host}/ws`],
  ] as const)('/stack-check (home health query) in %s', async (_label, packaged, origin, wsUrl) => {
    if (packaged) packagedMode()
    mount('/stack-check')
    expect(await screen.findByTestId('page-stack-check')).toBeInTheDocument()
    await waitFor(() => expect(fetchUrls).toContain(`${origin}${HEALTH_PATH}`))
    expect(fetchUrls.every((url) => url === `${origin}${HEALTH_PATH}`)).toBe(true)
    expect(new Set(socketUrls)).toEqual(new Set([wsUrl]))
  })
})
