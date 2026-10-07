/**
 * `simAwareFetch`: Scalar's `customFetch` (01_specs §14.9; D61; AC-58). Scalar calls it for every
 * Try-it request (H-S17: `OperationBlock` passes `options.customFetch` to `sendRequest`, which
 * calls it with a `Request`), and it decides where the request goes:
 *
 * | Request                                   | Answered by                                            |
 * |-------------------------------------------|--------------------------------------------------------|
 * | `GET {core}/api/v1/health`                | the real network: mock-core on 127.0.0.1:4400 (LIVE)   |
 * | any other `{core}/api/v1/*`               | the in-browser simulator (`sim.request`, via the       |
 * |                                           | adapter), a `Response` with `x-dems-simulated: 1`      |
 * | anything else                             | nobody: the Promise rejects (`BlockedRequestError`)    |
 *
 * `{core}` is `coreHttpOrigin()` (lib/core-endpoint), read when the fetch is created: 127.0.0.1:4400
 * in dev, the page's own origin in the packaged build (its launcher serves health; 06 §3.4).
 *
 * So nothing leaves the machine (NFR1): the only network request Try-it can make is the loopback
 * health call. The simulator applies the signed-in operator's role (export: INVESTIGATOR 403 plus
 * an EXPORT_DENIED audit row; SUPERVISOR 202 plus EVIDENCE_EXPORTED).
 *
 * Plan row W84 (backend task 04_client_integration_spec §11 AR-2): with `coreServerRefusal` set
 * (the page sets it while "Show Core-server endpoints" is on), a request of one of the 65
 * operations only the Core server answers is rejected before any request and before the simulator
 * is asked (`TryItRefusedError`, reason `CORE_SERVER`): the page never fabricates an answer for
 * them. Without it the routing is the table above, unchanged. Live mode has its own fetch
 * (try-it.ts).
 */
import { API_BASE_PATH, HEALTH_PATH, SIMULATED_HEADER_NAME } from '@dems/shared/api'
import { coreHttpOrigin } from '@/lib/core-endpoint'
import { answerSimulated, type SimTarget } from './sim-adapter'
import { logApiReference } from './log'
import { BlockedRequestError, coreServerOnlyOperation, TryItRefusedError } from './try-it'

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

// The rejection for a URL outside the Core API lives beside the other Try-it rules (try-it.ts) and
// keeps its import path here.
export { BlockedRequestError }

export type TryItMode = 'live' | 'simulated'

/** One answered Try-it exchange (the page uses it for the response reveal; no body is kept). */
export interface TryItExchange {
  mode: TryItMode
  method: string
  path: string
  status: number
}

export interface SimAwareFetchOptions {
  sim: SimTarget
  /** The real fetch for the LIVE health call. Defaults to the global `fetch`. */
  networkFetch?: FetchLike
  /** Called after every answered exchange (not for blocked or failed ones). */
  onExchange?: (exchange: TryItExchange) => void
  /**
   * AR-2: when set, a request of an operation only the Core server answers is rejected with this
   * sentence before any request. Unset (the default): routed as the table above says.
   */
  coreServerRefusal?: string
}

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function requestMethod(input: string | URL | Request, init?: RequestInit): string {
  const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : undefined) ?? 'GET'
  return method.toUpperCase()
}

async function requestBody(input: string | URL | Request, init?: RequestInit): Promise<string | undefined> {
  if (init?.body !== undefined && init.body !== null) {
    if (typeof init.body === 'string') return init.body
    return new Response(init.body).text()
  }
  if (typeof input === 'object' && !(input instanceof URL) && input.body !== null) {
    return input.clone().text()
  }
  return undefined
}

function toResponse(status: number, headers: Record<string, string>, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers })
}

/** Builds the `customFetch` for one simulator. */
export function createSimAwareFetch(options: SimAwareFetchOptions): FetchLike {
  const { sim, onExchange, coreServerRefusal } = options
  const networkFetch: FetchLike = options.networkFetch ?? ((input, init) => globalThis.fetch(input, init))
  const coreBase = coreHttpOrigin()
  const coreOrigin = new URL(coreBase).origin

  return async function simAwareFetch(input, init) {
    const raw = requestUrl(input)
    let url: URL
    try {
      url = new URL(raw, coreBase)
    } catch {
      throw new BlockedRequestError(raw, coreBase)
    }
    const method = requestMethod(input, init)
    const inCoreApi =
      url.origin === coreOrigin && (url.pathname === API_BASE_PATH || url.pathname.startsWith(`${API_BASE_PATH}/`))
    if (!inCoreApi) {
      const blocked = new BlockedRequestError(url.origin + url.pathname, coreBase)
      logApiReference('warn', 'simAwareFetch.blocked', blocked, 'A Try-it request outside the Core API was blocked.', {
        method,
        path: url.pathname,
      })
      throw blocked
    }

    if (coreServerRefusal !== undefined && coreServerOnlyOperation(method, url.pathname) !== null) {
      const refused = new TryItRefusedError('CORE_SERVER', coreServerRefusal, method, url.pathname)
      logApiReference('warn', 'simAwareFetch.coreServer', refused, 'A Try-it request of a Core-server operation was refused in Simulated mode.', {
        method,
        path: url.pathname,
      })
      throw refused
    }

    // LIVE: the one endpoint mock-core serves goes to the network unchanged.
    if (method === 'GET' && url.pathname === HEALTH_PATH) {
      const response = await networkFetch(input, init)
      onExchange?.({ mode: 'live', method, path: url.pathname, status: response.status })
      return response
    }

    // SIMULATED: answered in this browser.
    const body = method === 'GET' || method === 'HEAD' ? undefined : await requestBody(input, init)
    const answer = answerSimulated(sim, { method, path: url.pathname, ...(body !== undefined ? { body } : {}) })
    if (answer.headers[SIMULATED_HEADER_NAME] === undefined) {
      logApiReference('warn', 'simAwareFetch.header', null, 'A simulated answer came without its x-dems-simulated header.', {
        method,
        path: url.pathname,
        status: answer.status,
      })
    }
    onExchange?.({ mode: 'simulated', method, path: url.pathname, status: answer.status })
    return toResponse(answer.status, answer.headers, answer.body)
  }
}
